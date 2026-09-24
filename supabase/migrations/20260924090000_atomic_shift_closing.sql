create or replace function public.cerrar_turno_atomic(p_jornada_id uuid, p_cierre jsonb)
returns public.cierres_caja
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jornada public.jornadas;
  v_cierre public.cierres_caja;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Sesión no autenticada';
  end if;

  select *
    into v_jornada
    from public.jornadas
   where id = p_jornada_id
     and user_id = v_user_id
     and estado = 'abierta'
   for update;

  if not found then
    raise exception 'El turno no existe, no pertenece al usuario o ya está cerrado';
  end if;

  if exists (
    select 1
      from public.cierres_caja
     where jornada_id = p_jornada_id
       and user_id = v_user_id
  ) then
    raise exception 'El turno ya tiene un arqueo registrado';
  end if;

  insert into public.cierres_caja (
    jornada_id,
    base_inicial,
    total_sistema,
    total_neto,
    efectivo_sistema,
    tarjeta_sistema,
    transferencia_sistema,
    gastos_efectivo,
    gastos_tarjeta,
    gastos_transferencia,
    total_gastos,
    efectivo_real,
    tarjeta_real,
    transferencia_real,
    diferencia_efectivo,
    diferencia_tarjeta,
    diferencia_transferencia,
    user_id
  )
  values (
    p_jornada_id,
    (p_cierre->>'base_inicial')::numeric,
    (p_cierre->>'total_sistema')::numeric,
    (p_cierre->>'total_neto')::numeric,
    (p_cierre->>'efectivo_sistema')::numeric,
    (p_cierre->>'tarjeta_sistema')::numeric,
    (p_cierre->>'transferencia_sistema')::numeric,
    (p_cierre->>'gastos_efectivo')::numeric,
    (p_cierre->>'gastos_tarjeta')::numeric,
    (p_cierre->>'gastos_transferencia')::numeric,
    (p_cierre->>'total_gastos')::numeric,
    (p_cierre->>'efectivo_real')::numeric,
    (p_cierre->>'tarjeta_real')::numeric,
    (p_cierre->>'transferencia_real')::numeric,
    (p_cierre->>'diferencia_efectivo')::numeric,
    (p_cierre->>'diferencia_tarjeta')::numeric,
    (p_cierre->>'diferencia_transferencia')::numeric,
    v_user_id
  )
  returning * into v_cierre;

  update public.ventas
     set cierre_id = v_cierre.id
   where jornada_id = p_jornada_id
     and user_id = v_user_id
     and cierre_id is null;

  update public.gastos
     set cierre_id = v_cierre.id
   where jornada_id = p_jornada_id
     and user_id = v_user_id
     and cierre_id is null;

  update public.jornadas
     set estado = 'cerrada'
   where id = p_jornada_id;

  return v_cierre;
end;
$$;

revoke all on function public.cerrar_turno_atomic(uuid, jsonb) from public;
grant execute on function public.cerrar_turno_atomic(uuid, jsonb) to authenticated;
