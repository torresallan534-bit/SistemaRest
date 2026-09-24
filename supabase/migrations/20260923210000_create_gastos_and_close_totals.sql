create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  concepto text not null,
  monto numeric(12, 2) not null check (monto > 0),
  metodo_pago text not null check (metodo_pago in ('Efectivo', 'Tarjeta', 'Transferencia')),
  user_id uuid not null references auth.users(id) on delete cascade,
  jornada_id uuid references public.jornadas(id) on delete set null,
  cierre_id uuid references public.cierres_caja(id) on delete set null
);

alter table public.cierres_caja
  add column if not exists total_neto numeric(12, 2) not null default 0,
  add column if not exists total_gastos numeric(12, 2) not null default 0,
  add column if not exists gastos_efectivo numeric(12, 2) not null default 0,
  add column if not exists gastos_tarjeta numeric(12, 2) not null default 0,
  add column if not exists gastos_transferencia numeric(12, 2) not null default 0;

create index if not exists gastos_user_jornada_idx on public.gastos(user_id, jornada_id);
create index if not exists gastos_user_cierre_idx on public.gastos(user_id, cierre_id);

alter table public.gastos enable row level security;

create policy "Users can read their own expenses"
  on public.gastos for select
  using (auth.uid() = user_id);

create policy "Users can create their own expenses"
  on public.gastos for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own expenses"
  on public.gastos for delete
  using (auth.uid() = user_id);
