revoke all on function public.cobrar_mesa_dividida(uuid, uuid, jsonb)
  from public, anon;
grant execute on function public.cobrar_mesa_dividida(uuid, uuid, jsonb)
  to authenticated;

revoke all on function public.guardar_inventario_turno(uuid, jsonb, jsonb)
  from public, anon;
grant execute on function public.guardar_inventario_turno(uuid, jsonb, jsonb)
  to authenticated;

revoke all on function public.capture_shift_inventory_opening()
  from public, anon, authenticated;
