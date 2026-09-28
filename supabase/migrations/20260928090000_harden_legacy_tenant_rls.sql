drop policy if exists "Permitir todo en cierres_caja" on public.cierres_caja;
create policy "Owners can manage own closings"
  on public.cierres_caja for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Permitir todo en mesas" on public.mesas;
create policy "Owners can manage own tables"
  on public.mesas for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Permitir actualizacion insumos" on public.insumos;
drop policy if exists "Permitir eliminacion insumos" on public.insumos;
drop policy if exists "Permitir insercion insumos" on public.insumos;
drop policy if exists "Permitir lectura insumos" on public.insumos;
create policy "Owners can manage own ingredients"
  on public.insumos for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Permitir todo perfiles" on public.perfiles;
create policy "Owners can manage own profile"
  on public.perfiles for all to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Permitir actualizacion publica" on public.productos;
drop policy if exists "Permitir eliminacion publica" on public.productos;
drop policy if exists "Permitir insercion publica" on public.productos;
drop policy if exists "Permitir lectura publica" on public.productos;
create policy "Owners can manage own products"
  on public.productos for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Permitir actualizacion recetas" on public.recetas;
drop policy if exists "Permitir eliminacion recetas" on public.recetas;
drop policy if exists "Permitir insercion recetas" on public.recetas;
drop policy if exists "Permitir lectura recetas" on public.recetas;
create policy "Owners can manage own recipes"
  on public.recetas for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Permitir eliminacion ventas" on public.ventas;
drop policy if exists "Permitir insercion ventas" on public.ventas;
drop policy if exists "Permitir insertar ventas publicas" on public.ventas;
drop policy if exists "Permitir lectura ventas" on public.ventas;
drop policy if exists "Permitir leer ventas publicas" on public.ventas;
create policy "Owners can record sales on own open shifts"
  on public.ventas for insert to authenticated
  with check (
    auth.uid() = user_id
    and jornada_id is not null
    and exists (
      select 1
        from public.jornadas
       where jornadas.id = ventas.jornada_id
         and jornadas.user_id = ventas.user_id
         and jornadas.estado = 'abierta'
    )
  );
create policy "Owners can delete own sales"
  on public.ventas for delete to authenticated
  using (auth.uid() = user_id);
