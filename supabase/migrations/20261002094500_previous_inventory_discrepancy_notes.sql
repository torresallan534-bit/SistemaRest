create or replace function public.obtener_diferencias_inventario_anterior(p_jornada_id uuid)
returns table (
  insumo_id text,
  nombre text,
  unidad text,
  diferencia numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  v_caller_id uuid := auth.uid();
  v_jornada public.jornadas;
begin
  if v_caller_id is null then
    raise exception 'La sesión no está autenticada';
  end if;

  select *
    into v_jornada
    from public.jornadas
   where id = p_jornada_id;
  if not found or v_jornada.estado <> 'abierta' then
    raise exception 'El turno actual no está abierto';
  end if;
  if v_jornada.user_id <> v_caller_id
     and not exists (
       select 1
         from public.miembros_negocio
        where owner_user_id = v_jornada.user_id
          and auth_user_id = v_caller_id
          and role = 'mesero'
          and activo = true
     ) then
    raise exception 'No tienes permiso para consultar las diferencias de inventario';
  end if;

  return query
  with inventario_anterior as (
    select inventario.diferencias
      from public.inventarios_turno inventario
      join public.jornadas jornada_anterior
        on jornada_anterior.id = inventario.jornada_id
       and jornada_anterior.user_id = v_jornada.user_id
     where jornada_anterior.created_at < v_jornada.created_at
     order by jornada_anterior.created_at desc
     limit 1
  )
  select
    diferencia.key,
    coalesce(insumo.nombre, 'Insumo eliminado'),
    coalesce(insumo.unidad, ''),
    (diferencia.value #>> '{}')::numeric
    from inventario_anterior anterior
    cross join lateral jsonb_each(anterior.diferencias) diferencia
    left join public.insumos insumo
      on insumo.id::text = diferencia.key
     and insumo.user_id = v_jornada.user_id
   where (diferencia.value #>> '{}')::numeric <> 0
   order by coalesce(insumo.nombre, diferencia.key);
end;
$$;

revoke all on function public.obtener_diferencias_inventario_anterior(uuid) from public, anon;
grant execute on function public.obtener_diferencias_inventario_anterior(uuid) to authenticated;
