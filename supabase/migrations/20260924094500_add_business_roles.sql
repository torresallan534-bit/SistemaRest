create table if not exists public.miembros_negocio (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  username text not null unique,
  role text not null check (role in ('admin', 'mesero')),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.permisos_roles (
  role text not null check (role in ('admin', 'mesero')),
  permiso text not null,
  permitido boolean not null default true,
  primary key (role, permiso)
);

insert into public.permisos_roles (role, permiso)
values
  ('admin', 'mesas'),
  ('admin', 'pedidos'),
  ('admin', 'caja'),
  ('admin', 'gastos'),
  ('admin', 'historial'),
  ('admin', 'produccion'),
  ('admin', 'usuarios'),
  ('mesero', 'mesas'),
  ('mesero', 'pedidos')
on conflict (role, permiso) do nothing;

create or replace function public.es_miembro_negocio(p_owner_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.uid() = p_owner_user_id
    or exists (
      select 1 from public.miembros_negocio
      where owner_user_id = p_owner_user_id
        and auth_user_id = auth.uid()
        and activo = true
    );
$$;

alter table public.miembros_negocio enable row level security;

create policy "Members can read their business users"
  on public.miembros_negocio for select
  using (auth.uid() = owner_user_id or auth.uid() = auth_user_id);

create policy "Owners can manage business users"
  on public.miembros_negocio for all
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

create policy "Waiters can read business products"
  on public.productos for select
  using (public.es_miembro_negocio(user_id));

create policy "Waiters can read business tables"
  on public.mesas for select
  using (public.es_miembro_negocio(user_id));

create policy "Members can read business profile"
  on public.perfiles for select
  using (public.es_miembro_negocio(id));

create policy "Waiters can update business tables"
  on public.mesas for update
  using (public.es_miembro_negocio(user_id))
  with check (public.es_miembro_negocio(user_id));
