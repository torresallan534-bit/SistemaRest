drop policy if exists "Permitir todo en cierres_caja" on public.cierres_caja;
drop policy if exists "Owners can manage own closings" on public.cierres_caja;
create policy "Owners can read own closings"
  on public.cierres_caja for select to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on public.cierres_caja from authenticated;

drop policy if exists "Keep closed sales immutable" on public.ventas;
create policy "Keep closed sales immutable"
  on public.ventas as restrictive for update to authenticated
  using (cierre_id is null)
  with check (cierre_id is null);

drop policy if exists "Prevent deletion of closed sales" on public.ventas;
create policy "Prevent deletion of closed sales"
  on public.ventas as restrictive for delete to authenticated
  using (cierre_id is null);

drop policy if exists "Keep closed expenses immutable" on public.gastos;
create policy "Keep closed expenses immutable"
  on public.gastos as restrictive for update to authenticated
  using (cierre_id is null)
  with check (cierre_id is null);

drop policy if exists "Prevent deletion of closed expenses" on public.gastos;
create policy "Prevent deletion of closed expenses"
  on public.gastos as restrictive for delete to authenticated
  using (cierre_id is null);
