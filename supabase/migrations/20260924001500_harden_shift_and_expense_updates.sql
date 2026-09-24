create policy "Users can update their own expenses"
  on public.gastos for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create unique index if not exists jornadas_one_open_per_user_idx
  on public.jornadas(user_id)
  where estado = 'abierta';
