create policy "Business members can read owner shifts"
  on public.jornadas for select
  using (public.es_miembro_negocio(user_id));

create policy "Restrict business shift reads to active members"
  on public.jornadas as restrictive for select
  using (public.es_miembro_negocio(user_id));

create policy "Business members can read owner sales"
  on public.ventas for select
  using (public.es_miembro_negocio(user_id));

create policy "Restrict business sales reads to active members"
  on public.ventas as restrictive for select
  using (public.es_miembro_negocio(user_id));
