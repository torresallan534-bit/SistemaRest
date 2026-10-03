drop policy if exists "Waiters can update business tables" on public.mesas;
create policy "Active waiters can update business orders"
  on public.mesas for update to authenticated
  using (
    exists (
      select 1
        from public.miembros_negocio
       where owner_user_id = mesas.user_id
         and auth_user_id = auth.uid()
         and role = 'mesero'
         and activo = true
    )
  )
  with check (
    exists (
      select 1
        from public.miembros_negocio
       where owner_user_id = mesas.user_id
         and auth_user_id = auth.uid()
         and role = 'mesero'
         and activo = true
    )
  );

create policy "Restrict table updates to the owning business"
  on public.mesas as restrictive for update to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1
        from public.miembros_negocio
       where owner_user_id = mesas.user_id
         and auth_user_id = auth.uid()
         and role = 'mesero'
         and activo = true
    )
  )
  with check (
    auth.uid() = user_id
    or exists (
      select 1
        from public.miembros_negocio
       where owner_user_id = mesas.user_id
         and auth_user_id = auth.uid()
         and role = 'mesero'
         and activo = true
    )
  );

revoke update on public.mesas from authenticated;
grant update (
  pedidos,
  estado,
  cliente_nombre,
  cliente_documento,
  comentarios,
  pedido_creado_por,
  pedido_creado_nombre
) on public.mesas to authenticated;
