create or replace function public.crear_negocio_para_usuario(
  p_user_id uuid,
  p_nombre_persona text,
  p_nombre_local text,
  p_documento text,
  p_direccion text,
  p_telefono text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  mesa_nombre text;
begin
  if p_user_id is null
    or nullif(btrim(p_nombre_persona), '') is null
    or nullif(btrim(p_nombre_local), '') is null
    or nullif(btrim(p_documento), '') is null
    or nullif(btrim(p_direccion), '') is null
    or nullif(btrim(p_telefono), '') is null then
    raise exception 'Faltan datos para crear el perfil del negocio.';
  end if;

  if exists (select 1 from public.perfiles where id = p_user_id) then
    raise exception 'Este acceso ya tiene un perfil de negocio.';
  end if;

  insert into public.perfiles (
    id,
    nombre_persona,
    nombre_local,
    documento,
    direccion,
    telefono
  ) values (
    p_user_id,
    btrim(p_nombre_persona),
    btrim(p_nombre_local),
    btrim(p_documento),
    btrim(p_direccion),
    btrim(p_telefono)
  );

  foreach mesa_nombre in array array['Mesa 1', 'Mesa 2', 'Mesa 3', 'Mesa 4', 'Mesa 5']
  loop
    if not exists (
      select 1
        from public.mesas
       where user_id = p_user_id
         and nombre = mesa_nombre
    ) then
      insert into public.mesas (nombre, user_id, estado)
      values (mesa_nombre, p_user_id, 'libre');
    end if;
  end loop;
end;
$$;

create or replace function public.crear_perfil_negocio_actual(
  p_nombre_persona text,
  p_nombre_local text,
  p_documento text,
  p_direccion text,
  p_telefono text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  usuario_actual uuid;
begin
  usuario_actual := auth.uid();
  if usuario_actual is null then
    raise exception 'Inicia sesión para completar el perfil del negocio.';
  end if;

  perform public.crear_negocio_para_usuario(
    usuario_actual,
    p_nombre_persona,
    p_nombre_local,
    p_documento,
    p_direccion,
    p_telefono
  );
end;
$$;

create or replace function public.crear_negocio_al_registrar_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_user_meta_data ->> 'tipo_cuenta' is distinct from 'negocio' then
    return new;
  end if;

  perform public.crear_negocio_para_usuario(
    new.id,
    new.raw_user_meta_data ->> 'nombre_persona',
    new.raw_user_meta_data ->> 'nombre_local',
    new.raw_user_meta_data ->> 'documento',
    new.raw_user_meta_data ->> 'direccion',
    new.raw_user_meta_data ->> 'telefono'
  );

  return new;
end;
$$;

revoke all on function public.crear_negocio_para_usuario(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.crear_perfil_negocio_actual(text, text, text, text, text) from public, anon;
grant execute on function public.crear_perfil_negocio_actual(text, text, text, text, text) to authenticated;
revoke all on function public.crear_negocio_al_registrar_auth_user() from public, anon, authenticated;

drop trigger if exists crear_negocio_despues_registro_auth on auth.users;
create trigger crear_negocio_despues_registro_auth
  after insert on auth.users
  for each row
  execute function public.crear_negocio_al_registrar_auth_user();
