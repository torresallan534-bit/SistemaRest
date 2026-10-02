create policy "Restrict sales history to business owners"
  on public.ventas as restrictive for select
  using (auth.uid() = user_id);

create policy "Restrict shift history to owners and active shifts"
  on public.jornadas as restrictive for select
  using (
    auth.uid() = user_id
    or (
      estado = 'abierta'
      and public.es_miembro_negocio(user_id)
    )
  );
