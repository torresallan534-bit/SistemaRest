alter table public.ventas
  add column if not exists creado_por uuid references auth.users(id) on delete set null,
  add column if not exists nombre_vendedor text,
  add column if not exists grupo_division_id uuid,
  add column if not exists consumo_insumos jsonb;

alter table public.mesas
  add column if not exists pedido_creado_por uuid references auth.users(id) on delete set null,
  add column if not exists pedido_creado_nombre text;

alter table public.jornadas
  add column if not exists inventario_inicial jsonb not null default '{}'::jsonb;

create table if not exists public.inventarios_turno (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  jornada_id uuid not null unique references public.jornadas(id) on delete cascade,
  cierre_id uuid references public.cierres_caja(id) on delete set null,
  stock_inicial jsonb not null,
  entradas jsonb not null,
  conteo_final jsonb not null,
  consumo_esperado jsonb not null,
  diferencias jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists inventarios_turno_user_jornada_idx
  on public.inventarios_turno(user_id, jornada_id);

alter table public.inventarios_turno enable row level security;

drop policy if exists "Owners can read shift inventories" on public.inventarios_turno;
create policy "Owners can read shift inventories"
  on public.inventarios_turno for select
  using (auth.uid() = user_id);

create or replace function public.capture_shift_inventory_opening()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.inventario_inicial is null or new.inventario_inicial = '{}'::jsonb then
    select coalesce(jsonb_object_agg(id::text, stock_actual), '{}'::jsonb)
      into new.inventario_inicial
      from public.insumos
     where user_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists jornadas_capture_inventory_opening on public.jornadas;
create trigger jornadas_capture_inventory_opening
  before insert on public.jornadas
  for each row execute function public.capture_shift_inventory_opening();

create or replace function public.cobrar_mesa_dividida(
  p_mesa_id uuid,
  p_jornada_id uuid,
  p_divisiones jsonb
)
returns setof public.ventas
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_mesa public.mesas;
  v_jornada public.jornadas;
  v_owner_id uuid;
  v_vendedor text;
  v_grupo uuid := gen_random_uuid();
  v_division jsonb;
  v_item jsonb;
  v_linea jsonb;
  v_producto record;
  v_line_id text;
  v_producto_id text;
  v_cantidad numeric;
  v_cantidad_original numeric;
  v_asignada numeric;
  v_total numeric;
  v_productos jsonb;
  v_consumos jsonb;
  v_consumo_line record;
  v_venta public.ventas;
begin
  if v_caller_id is null then
    raise exception 'La sesión no está autenticada';
  end if;
  if jsonb_typeof(p_divisiones) is distinct from 'array' then
    raise exception 'La cuenta debe incluir entre una y cincuenta facturas';
  end if;
  if jsonb_array_length(p_divisiones) < 1 or jsonb_array_length(p_divisiones) > 50 then
    raise exception 'La cuenta debe incluir entre una y cincuenta facturas';
  end if;

  select *
    into v_mesa
    from public.mesas
   where id = p_mesa_id
   for update;
  if not found then
    raise exception 'No se encontró la mesa';
  end if;

  v_owner_id := v_mesa.user_id;
  if not public.es_miembro_negocio(v_owner_id) then
    raise exception 'No tienes acceso a este negocio';
  end if;

  select *
    into v_jornada
    from public.jornadas
   where id = p_jornada_id
     and user_id = v_owner_id
     and estado = 'abierta'
   for share;
  if not found then
    raise exception 'El negocio no tiene un turno abierto para registrar esta venta';
  end if;

  if jsonb_typeof(v_mesa.pedidos::jsonb) <> 'array'
     or jsonb_array_length(v_mesa.pedidos::jsonb) = 0 then
    raise exception 'La mesa no tiene un pedido pendiente';
  end if;

  if v_caller_id = v_owner_id then
    select nombre_persona into v_vendedor
      from public.perfiles
     where id = v_owner_id;
    v_vendedor := coalesce(nullif(v_vendedor, ''), 'Administrador');
  else
    select username into v_vendedor
      from public.miembros_negocio
     where auth_user_id = v_caller_id
       and owner_user_id = v_owner_id
       and role = 'mesero'
       and activo = true;
    if v_vendedor is null then
      raise exception 'El acceso de mesero no está activo en este negocio';
    end if;
  end if;

  for v_linea in select value from jsonb_array_elements(v_mesa.pedidos::jsonb)
  loop
    v_line_id := v_linea->>'id';
    v_producto_id := coalesce(v_linea->>'productoId', v_linea->>'producto_id');
    v_cantidad_original := (v_linea->>'cantidad')::numeric;
    if v_line_id is null or v_producto_id is null
       or v_cantidad_original is null or v_cantidad_original <= 0 then
      raise exception 'El pedido contiene una línea inválida';
    end if;

    select coalesce(sum((item->>'cantidad')::numeric), 0)
      into v_asignada
      from jsonb_array_elements(p_divisiones) division
      cross join lateral jsonb_array_elements(coalesce(division->'items', '[]'::jsonb)) item
     where item->>'linea_id' = v_line_id
       and item->>'producto_id' = v_producto_id;
    if v_asignada <> v_cantidad_original then
      raise exception 'La asignación de productos no coincide con el pedido original';
    end if;
  end loop;

  for v_division in select value from jsonb_array_elements(p_divisiones)
  loop
    if coalesce(v_division->>'metodo_pago', '') not in ('Efectivo', 'Tarjeta', 'Transferencia') then
      raise exception 'Una de las facturas tiene un método de pago inválido';
    end if;
    if jsonb_typeof(v_division->'items') is distinct from 'array' then
      raise exception 'Cada factura debe tener productos asignados';
    end if;
    if jsonb_array_length(v_division->'items') = 0 then
      raise exception 'Cada factura debe tener productos asignados';
    end if;

    v_total := 0;
    v_productos := '[]'::jsonb;
    v_consumos := '{}'::jsonb;
    for v_item in select value from jsonb_array_elements(v_division->'items')
    loop
      v_line_id := v_item->>'linea_id';
      v_producto_id := v_item->>'producto_id';
      v_cantidad := (v_item->>'cantidad')::numeric;
      if v_line_id is null or v_producto_id is null
         or v_cantidad is null or v_cantidad <= 0 or v_cantidad <> trunc(v_cantidad) then
        raise exception 'Las cantidades por factura deben ser enteros positivos';
      end if;

      select value into v_linea
        from jsonb_array_elements(v_mesa.pedidos::jsonb)
       where value->>'id' = v_line_id;
      if not found
         or coalesce(v_linea->>'productoId', v_linea->>'producto_id') <> v_producto_id
         or v_cantidad > (v_linea->>'cantidad')::numeric then
        raise exception 'Una factura contiene productos o cantidades que no pertenecen al pedido';
      end if;

      select id, nombre, precio
        into v_producto
        from public.productos
       where id::text = v_producto_id
         and user_id = v_owner_id;
      if not found then
        raise exception 'No se encontró un producto válido del negocio';
      end if;

      v_total := v_total + v_producto.precio * v_cantidad;
      v_productos := v_productos || jsonb_build_array(jsonb_build_object(
        'producto_id', v_producto.id,
        'nombre', v_producto.nombre,
        'cantidad', v_cantidad,
        'precioUnitario', v_producto.precio,
        'subtotal', v_producto.precio * v_cantidad
      ));

      for v_consumo_line in
        select insumo_id, sum(cantidad_requerida * v_cantidad) as cantidad
          from public.recetas
         where user_id = v_owner_id
           and producto_id = v_producto.id
         group by insumo_id
      loop
        v_consumos := jsonb_set(
          v_consumos,
          array[v_consumo_line.insumo_id::text],
          to_jsonb(coalesce((v_consumos->>v_consumo_line.insumo_id::text)::numeric, 0) + v_consumo_line.cantidad),
          true
        );
      end loop;
    end loop;

    if v_total <= 0 then
      raise exception 'El total de cada factura debe ser mayor que cero';
    end if;

    insert into public.ventas (
      cliente,
      documento,
      metodo_pago,
      productos,
      total,
      user_id,
      jornada_id,
      creado_por,
      nombre_vendedor,
      grupo_division_id,
      consumo_insumos
    )
    values (
      coalesce(nullif(v_division->>'nombre', ''), nullif(v_mesa.cliente_nombre, ''), 'Consumidor Final'),
      coalesce(nullif(v_mesa.cliente_documento, ''), 'N/A'),
      v_division->>'metodo_pago',
      v_productos,
      v_total,
      v_owner_id,
      p_jornada_id,
      v_caller_id,
      v_vendedor,
      v_grupo,
      v_consumos
    )
    returning * into v_venta;
    return next v_venta;
  end loop;

  update public.mesas
     set pedidos = '[]'::jsonb,
         estado = 'libre',
         cliente_nombre = '',
         cliente_documento = '',
         comentarios = '',
         pedido_creado_por = null,
         pedido_creado_nombre = null
   where id = p_mesa_id;
end;
$$;

revoke all on function public.cobrar_mesa_dividida(uuid, uuid, jsonb) from public, anon;
grant execute on function public.cobrar_mesa_dividida(uuid, uuid, jsonb) to authenticated;

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

revoke all on function public.guardar_inventario_turno(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.guardar_inventario_turno(uuid, jsonb, jsonb) to authenticated;
