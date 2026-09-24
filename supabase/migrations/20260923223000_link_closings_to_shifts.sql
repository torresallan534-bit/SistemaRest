alter table public.cierres_caja
  add column if not exists jornada_id uuid references public.jornadas(id) on delete set null;

create index if not exists cierres_caja_user_jornada_idx
  on public.cierres_caja(user_id, jornada_id);

update public.cierres_caja cierre
set jornada_id = ventas.jornada_id
from (
  select distinct on (cierre_id)
    cierre_id,
    jornada_id
  from public.ventas
  where cierre_id is not null
    and jornada_id is not null
  order by cierre_id, created_at asc
) ventas
where cierre.id = ventas.cierre_id
  and cierre.jornada_id is null;

update public.gastos gasto
set cierre_id = cierre.id
from public.cierres_caja cierre
where gasto.cierre_id is null
  and gasto.jornada_id = cierre.jornada_id
  and gasto.user_id = cierre.user_id;
