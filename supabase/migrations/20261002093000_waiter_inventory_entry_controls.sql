create table if not exists public.inventario_entradas_turno (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  jornada_id uuid not null unique references public.jornadas(id) on delete cascade,
  stock_inicial jsonb not null,
  entradas jsonb not null,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.inventario_entradas_turno (
  user_id,
  jornada_id,
  stock_inicial,
  entradas,
  created_by,
  updated_by,
  created_at,
  updated_at
)
select
  user_id,
  jornada_id,
  stock_inicial,
  entradas,
  user_id,
  user_id,
  created_at,
  created_at
from public.inventarios_turno
on conflict (jornada_id) do nothing;

alter table public.inventario_entradas_turno enable row level security;

revoke all on public.inventario_entradas_turno from anon, authenticated;
grant select on public.inventario_entradas_turno to authenticated;

create policy "Business members can read active shift inventory entries"
  on public.inventario_entradas_turno for select to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1
        from public.jornadas
       where jornadas.id = inventario_entradas_turno.jornada_id
         and jornadas.user_id = inventario_entradas_turno.user_id
         and jornadas.estado = 'abierta'
         and public.es_miembro_negocio(inventario_entradas_turno.user_id)
    )
  );

drop policy if exists "Business members can read active shift inventories" on public.inventarios_turno;
create policy "Business members can read active shift inventories"
  on public.inventarios_turno for select to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1
        from public.jornadas
       where jornadas.id = inventarios_turno.jornada_id
         and jornadas.user_id = inventarios_turno.user_id
         and jornadas.estado = 'abierta'
         and public.es_miembro_negocio(inventarios_turno.user_id)
    )
  );

create policy "Waiters can read business ingredients"
  on public.insumos for select to authenticated
  using (public.es_miembro_negocio(user_id));

insert into public.permisos_roles (role, permiso, permitido)
values ('mesero', 'inventario', true)
on conflict (role, permiso) do update
set permitido = excluded.permitido;

create or replace function public.guardar_entradas_inventario_turno(
  p_jornada_id uuid,
  p_entradas jsonb
)
returns public.inventario_entradas_turno
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_jornada public.jornadas;
  v_owner_id uuid;
  v_registro public.inventario_entradas_turno;
  v_stock_inicial jsonb := '{}'::jsonb;
  v_insumo record;
  v_ya_existe boolean;
begin
  if v_caller_id is null then
    raise exception 'La sesión no está autenticada';
  end if;

  select *
    into v_jornada
    from public.jornadas
   where id = p_jornada_id
   for update;
  if not found then
    raise exception 'No se encontró el turno';
  end if;

  v_owner_id := v_jornada.user_id;
  if v_jornada.estado <> 'abierta' then
    raise exception 'Las entradas solo se pueden registrar en un turno abierto';
  end if;
  if v_caller_id <> v_owner_id
     and not exists (
       select 1
         from public.miembros_negocio
        where owner_user_id = v_owner_id
          and auth_user_id = v_caller_id
          and role = 'mesero'
          and activo = true
     ) then
    raise exception 'No tienes permiso para registrar inventario en este negocio';
  end if;
  if jsonb_typeof(p_entradas) is distinct from 'object' then
    raise exception 'Las entradas deben tener un formato válido';
  end if;
  if (select count(*) from jsonb_object_keys(p_entradas))
       <> (select count(*) from public.insumos where user_id = v_owner_id)
     or exists (
       select 1
         from public.insumos
        where user_id = v_owner_id
          and not (p_entradas ? id::text)
     ) then
    raise exception 'Las entradas deben incluir exactamente todos los insumos del negocio';
  end if;
  if exists (
    select 1
      from jsonb_each(p_entradas) entrada
     where jsonb_typeof(entrada.value) <> 'number'
        or (entrada.value::text)::numeric < 0
  ) then
    raise exception 'Las cantidades de entrada deben ser números iguales o mayores que cero';
  end if;
  if exists (
    select 1
      from public.inventarios_turno
     where jornada_id = p_jornada_id
       and user_id = v_owner_id
  ) then
    raise exception 'El inventario final ya se guardó; las entradas están bloqueadas';
  end if;

  select exists (
    select 1
      from public.inventario_entradas_turno
     where jornada_id = p_jornada_id
       and user_id = v_owner_id
  ) into v_ya_existe;
  if v_ya_existe and v_caller_id <> v_owner_id then
    raise exception 'Solo el administrador puede corregir entradas ya guardadas';
  end if;

  if not v_ya_existe then
    for v_insumo in
      select id, stock_actual
        from public.insumos
       where user_id = v_owner_id
       order by id
    loop
      v_stock_inicial := v_stock_inicial || jsonb_build_object(
        v_insumo.id::text,
        coalesce(
          nullif(v_jornada.inventario_inicial->>v_insumo.id::text, '')::numeric,
          v_insumo.stock_actual
        )
      );
    end loop;

    insert into public.inventario_entradas_turno (
      user_id, jornada_id, stock_inicial, entradas, created_by, updated_by
    )
    values (
      v_owner_id, p_jornada_id, v_stock_inicial, p_entradas, v_caller_id, v_caller_id
    )
    returning * into v_registro;
  else
    update public.inventario_entradas_turno
       set entradas = p_entradas,
           updated_by = v_caller_id,
           updated_at = now()
     where jornada_id = p_jornada_id
       and user_id = v_owner_id
    returning * into v_registro;
  end if;

  return v_registro;
end;
$$;

create or replace function public.obtener_consumo_inventario_turno(p_jornada_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  v_caller_id uuid := auth.uid();
  v_jornada public.jornadas;
  v_insumo record;
  v_consumo numeric;
  v_consumo_legacy numeric;
  v_resumen jsonb := '{}'::jsonb;
begin
  if v_caller_id is null then
    raise exception 'La sesión no está autenticada';
  end if;

  select *
    into v_jornada
    from public.jornadas
   where id = p_jornada_id;
  if not found or v_jornada.estado <> 'abierta' then
    raise exception 'El turno no está abierto';
  end if;
  if v_jornada.user_id <> v_caller_id
     and not public.es_miembro_negocio(v_jornada.user_id) then
    raise exception 'No tienes permiso para consultar el inventario de este turno';
  end if;

  for v_insumo in
    select id
      from public.insumos
     where user_id = v_jornada.user_id
     order by id
  loop
    select coalesce(sum(coalesce((v.consumo_insumos->>v_insumo.id::text)::numeric, 0)), 0)
      into v_consumo
      from public.ventas v
     where v.jornada_id = p_jornada_id
       and v.user_id = v_jornada.user_id
       and v.consumo_insumos is not null;

    select coalesce(sum(r.cantidad_requerida * (detalle->>'cantidad')::numeric), 0)
      into v_consumo_legacy
      from public.recetas r
      join public.productos p
        on p.id = r.producto_id
       and p.user_id = v_jornada.user_id
      join public.ventas v
        on v.jornada_id = p_jornada_id
       and v.user_id = v_jornada.user_id
      cross join lateral jsonb_array_elements(coalesce(v.productos::jsonb, '[]'::jsonb)) detalle
     where r.user_id = v_jornada.user_id
       and r.insumo_id = v_insumo.id
       and v.consumo_insumos is null
       and (
         detalle->>'producto_id' = r.producto_id::text
         or (detalle->>'producto_id' is null and detalle->>'nombre' = p.nombre)
       );
    v_resumen := v_resumen || jsonb_build_object(v_insumo.id::text, v_consumo + v_consumo_legacy);
  end loop;

  return v_resumen;
end;
$$;

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
  v_owner_id uuid;
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
  v_entradas_turno public.inventario_entradas_turno;
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
  if not found then
    raise exception 'No se encontró el turno';
  end if;

  v_owner_id := v_jornada.user_id;
  if v_caller_id <> v_owner_id then
    if v_jornada.estado <> 'abierta'
       or not exists (
         select 1
           from public.miembros_negocio
          where owner_user_id = v_owner_id
            and auth_user_id = v_caller_id
            and role = 'mesero'
            and activo = true
       ) then
      raise exception 'Solo el administrador o un mesero activo pueden guardar el inventario de este turno';
    end if;
  end if;
  if v_jornada.estado <> 'abierta' and exists (
    select 1 from public.jornadas
     where user_id = v_owner_id
       and created_at > v_jornada.created_at
  ) then
    raise exception 'Este turno ya no es el más reciente; abre un nuevo turno para registrar inventario';
  end if;
  if jsonb_typeof(p_conteos) is distinct from 'object' then
    raise exception 'Los conteos deben tener un formato válido';
  end if;

  select *
    into v_entradas_turno
    from public.inventario_entradas_turno
   where jornada_id = p_jornada_id
     and user_id = v_owner_id
   for share;
  if not found then
    raise exception 'Guarda primero las entradas recibidas al inicio del turno';
  end if;
  if p_entradas is distinct from v_entradas_turno.entradas then
    raise exception 'Las entradas recibidas no coinciden con el registro autorizado';
  end if;
  if (select count(*) from jsonb_object_keys(p_conteos))
       <> (select count(*) from public.insumos where user_id = v_owner_id)
     or exists (
       select 1
         from public.insumos
        where user_id = v_owner_id
          and not (p_conteos ? id::text)
     ) then
    raise exception 'Los conteos deben incluir exactamente todos los insumos del negocio';
  end if;
  if exists (
    select 1
      from jsonb_each(p_conteos) conteo
     where jsonb_typeof(conteo.value) <> 'number'
        or (conteo.value::text)::numeric < 0
  ) then
    raise exception 'Las cantidades del conteo deben ser números iguales o mayores que cero';
  end if;
  if exists (select 1 from public.inventarios_turno where jornada_id = p_jornada_id) then
    raise exception 'El inventario de este turno ya fue guardado y está bloqueado';
  end if;

  select id into v_cierre_id
    from public.cierres_caja
   where jornada_id = p_jornada_id
     and user_id = v_owner_id
   limit 1;

  for v_insumo in
    select id, stock_actual
      from public.insumos
     where user_id = v_owner_id
     order by id
  loop
    v_stock_inicial := coalesce(
      nullif(v_entradas_turno.stock_inicial->>v_insumo.id::text, '')::numeric,
      v_insumo.stock_actual
    );
    v_entrada := coalesce(nullif(v_entradas_turno.entradas->>v_insumo.id::text, '')::numeric, 0);
    v_conteo := (p_conteos->>v_insumo.id::text)::numeric;

    select coalesce(sum(coalesce((v.consumo_insumos->>v_insumo.id::text)::numeric, 0)), 0)
      into v_consumo
      from public.ventas v
     where v.jornada_id = p_jornada_id
       and v.user_id = v_owner_id
       and v.consumo_insumos is not null;

    select coalesce(sum(r.cantidad_requerida * (detalle->>'cantidad')::numeric), 0)
      into v_consumo_legacy
      from public.recetas r
      join public.productos p
        on p.id = r.producto_id
       and p.user_id = v_owner_id
      join public.ventas v
        on v.jornada_id = p_jornada_id
       and v.user_id = v_owner_id
      cross join lateral jsonb_array_elements(coalesce(v.productos::jsonb, '[]'::jsonb)) detalle
     where r.user_id = v_owner_id
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

  insert into public.inventarios_turno (
    user_id, jornada_id, cierre_id, stock_inicial, entradas,
    conteo_final, consumo_esperado, diferencias
  )
  values (
    v_owner_id, p_jornada_id, v_cierre_id, v_iniciales, v_entradas,
    v_finales, v_consumos, v_diferencias
  )
  returning * into v_resultado;

  update public.insumos insumo
     set stock_actual = (v_finales->>insumo.id::text)::numeric
   where insumo.user_id = v_owner_id
     and v_finales ? insumo.id::text;

  return v_resultado;
end;
$$;

revoke all on function public.guardar_entradas_inventario_turno(uuid, jsonb) from public, anon;
grant execute on function public.guardar_entradas_inventario_turno(uuid, jsonb) to authenticated;

revoke all on function public.obtener_consumo_inventario_turno(uuid) from public, anon;
grant execute on function public.obtener_consumo_inventario_turno(uuid) to authenticated;

revoke all on function public.guardar_inventario_turno(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.guardar_inventario_turno(uuid, jsonb, jsonb) to authenticated;
