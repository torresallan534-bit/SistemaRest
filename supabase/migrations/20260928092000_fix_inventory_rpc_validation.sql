create or replace function public.guardar_inventario_turno(
  p_jornada_id uuid,
  p_entradas jsonb,
  p_conteos jsonb
)
returns public.inventarios_turno
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_jornada public.jornadas;
  v_insumo record;
  v_stock_inicial numeric;
  v_entrada numeric;
  v_conteo numeric;
  v_consumo numeric;
  v_consumo_legacy numeric;
  v_esperado numeric;
  v_iniciales jsonb := '{}'::jsonb;
  v_entradas jsonb := '{}'::jsonb;
  v_finales jsonb := '{}'::jsonb;
  v_consumos jsonb := '{}'::jsonb;
  v_diferencias jsonb := '{}'::jsonb;
  v_resultado public.inventarios_turno;
  v_cierre_id uuid;
begin
  if v_caller_id is null then
    raise exception 'La sesión no está autenticada';
  end if;

  select *
    into v_jornada
    from public.jornadas
   where id = p_jornada_id
   for share;
  if not found or v_jornada.user_id <> v_caller_id then
    raise exception 'Solo el administrador del negocio puede cerrar su inventario';
  end if;
  if v_jornada.estado <> 'abierta' and exists (
    select 1 from public.jornadas
     where user_id = v_caller_id
       and created_at > v_jornada.created_at
  ) then
    raise exception 'Este turno ya no es el más reciente; abre un nuevo turno para registrar inventario';
  end if;
  if jsonb_typeof(p_entradas) is distinct from 'object'
     or jsonb_typeof(p_conteos) is distinct from 'object' then
    raise exception 'Las entradas y los conteos deben tener un formato válido';
  end if;
  if (select count(*) from jsonb_object_keys(p_entradas))
       <> (select count(*) from public.insumos where user_id = v_caller_id)
     or (select count(*) from jsonb_object_keys(p_conteos))
       <> (select count(*) from public.insumos where user_id = v_caller_id) then
    raise exception 'Las entradas y conteos deben coincidir exactamente con los insumos del negocio';
  end if;
  if exists (
    select 1
      from public.insumos
     where user_id = v_caller_id
       and (not (p_entradas ? id::text) or not (p_conteos ? id::text))
  ) then
    raise exception 'Las entradas y conteos deben incluir todos los insumos del negocio';
  end if;
  if exists (select 1 from public.inventarios_turno where jornada_id = p_jornada_id) then
    raise exception 'El inventario de este turno ya fue guardado y está bloqueado';
  end if;

  select id into v_cierre_id
    from public.cierres_caja
   where jornada_id = p_jornada_id
     and user_id = v_caller_id
   limit 1;

  for v_insumo in
    select id, stock_actual
      from public.insumos
     where user_id = v_caller_id
     order by id
  loop
    v_stock_inicial := coalesce(nullif(v_jornada.inventario_inicial->>v_insumo.id::text, '')::numeric, v_insumo.stock_actual);
    v_entrada := coalesce(nullif(p_entradas->>v_insumo.id::text, '')::numeric, 0);
    if p_conteos->>v_insumo.id::text is null then
      raise exception 'Falta el conteo final de uno o más insumos';
    end if;
    v_conteo := (p_conteos->>v_insumo.id::text)::numeric;
    if v_stock_inicial < 0 or v_entrada < 0 or v_conteo < 0 then
      raise exception 'Las cantidades de inventario no pueden ser negativas';
    end if;

    select coalesce(sum(coalesce((v.consumo_insumos->>v_insumo.id::text)::numeric, 0)), 0)
      into v_consumo
      from public.ventas v
     where v.jornada_id = p_jornada_id
       and v.user_id = v_caller_id
       and v.consumo_insumos is not null;

    select coalesce(sum(r.cantidad_requerida * (detalle->>'cantidad')::numeric), 0)
      into v_consumo_legacy
      from public.recetas r
      join public.productos p
        on p.id = r.producto_id
       and p.user_id = v_caller_id
      join public.ventas v
        on v.jornada_id = p_jornada_id
       and v.user_id = v_caller_id
      cross join lateral jsonb_array_elements(coalesce(v.productos::jsonb, '[]'::jsonb)) detalle
     where r.user_id = v_caller_id
       and r.insumo_id = v_insumo.id
       and v.consumo_insumos is null
       and (
         detalle->>'producto_id' = r.producto_id::text
         or (detalle->>'producto_id' is null and detalle->>'nombre' = p.nombre)
       );
    v_consumo := v_consumo + v_consumo_legacy;

    v_esperado := v_stock_inicial + v_entrada - v_consumo;
    v_iniciales := v_iniciales || jsonb_build_object(v_insumo.id::text, v_stock_inicial);
    v_entradas := v_entradas || jsonb_build_object(v_insumo.id::text, v_entrada);
    v_finales := v_finales || jsonb_build_object(v_insumo.id::text, v_conteo);
    v_consumos := v_consumos || jsonb_build_object(v_insumo.id::text, v_consumo);
    v_diferencias := v_diferencias || jsonb_build_object(v_insumo.id::text, v_conteo - v_esperado);
  end loop;

  if (select count(*) from public.insumos where user_id = v_caller_id)
       <> (select count(*) from jsonb_object_keys(p_conteos)) then
    raise exception 'Los conteos no coinciden con los insumos registrados';
  end if;

  insert into public.inventarios_turno (
    user_id, jornada_id, cierre_id, stock_inicial, entradas,
    conteo_final, consumo_esperado, diferencias
  )
  values (
    v_caller_id, p_jornada_id, v_cierre_id, v_iniciales, v_entradas,
    v_finales, v_consumos, v_diferencias
  )
  returning * into v_resultado;

  update public.insumos insumo
     set stock_actual = (v_finales->>insumo.id::text)::numeric
   where insumo.user_id = v_caller_id
     and v_finales ? insumo.id::text;

  return v_resultado;
end;
$$;
