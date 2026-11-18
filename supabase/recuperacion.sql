-- ===========================================================================
-- PASION MOTORS · RECUPERACIÓN DE CONTRASEÑA
-- ---------------------------------------------------------------------------
-- Ejecuta TODO este archivo en Supabase → SQL Editor (idempotente).
--
-- Seguridad:
--   · El código NUNCA se guarda en texto plano: solo su hash HMAC-SHA256.
--   · Caduca a los 15 minutos, es de un solo uso y admite 5 intentos.
--   · Límite de 3 solicitudes por usuario / 15 min y 10 por IP / hora.
--   · Solo el servidor (service_role) puede leer o escribir esta tabla.
-- ===========================================================================

create table if not exists public.password_resets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  email       text not null,
  code_hash   text not null,
  expires_at  timestamptz not null,
  attempts    int not null default 0,
  used_at     timestamptz,
  request_ip  text,
  created_at  timestamptz not null default now()
);

-- La IP se guarda como hash HMAC-SHA256 (no en texto plano) para limitar
-- solicitudes sin almacenar datos personales.
do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'password_resets'
       and column_name = 'request_ip'
  ) then
    alter table public.password_resets rename column request_ip to request_ip_hash;
  end if;
end $$;

create index if not exists password_resets_user_idx
  on public.password_resets (user_id, created_at desc);
create index if not exists password_resets_email_idx
  on public.password_resets (email, created_at desc);

alter table public.password_resets enable row level security;
revoke all on public.password_resets from anon, authenticated;
grant all on public.password_resets to service_role;

-- ---------------------------------------------------------------------------
-- Buscar el usuario por correo (fuente de verdad: auth.users)
-- ---------------------------------------------------------------------------
create or replace function public.find_user_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(btrim(p_email)) limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Crear un código (invalida los anteriores y aplica rate limit)
-- ---------------------------------------------------------------------------
create or replace function public.create_password_reset(
  p_user_id  uuid,
  p_email    text,
  p_code_hash text,
  p_ttl_minutes int default 15,
  p_ip       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent    int;
  v_ip_recent int;
  v_id        uuid;
  v_ttl       int := greatest(5, least(coalesce(p_ttl_minutes, 15), 30));
begin
  -- Higiene: borra códigos viejos ya usados o expirados (más de 30 días).
  delete from public.password_resets
   where created_at < now() - interval '30 days'
     and (used_at is not null or expires_at < now());

  select count(*) into v_recent
    from public.password_resets
   where user_id = p_user_id and created_at > now() - interval '15 minutes';
  if v_recent >= 3 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  if p_ip is not null and p_ip <> '' then
    select count(*) into v_ip_recent
      from public.password_resets
     where request_ip_hash = p_ip and created_at > now() - interval '1 hour';
    if v_ip_recent >= 10 then
      return jsonb_build_object('ok', false, 'error', 'rate_limited');
    end if;
  end if;

  update public.password_resets
     set used_at = now()
   where user_id = p_user_id and used_at is null;

  insert into public.password_resets (user_id, email, code_hash, expires_at, request_ip_hash)
  values (p_user_id, lower(btrim(p_email)), p_code_hash,
          now() + make_interval(mins => v_ttl), nullif(p_ip, ''))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'ttlMinutes', v_ttl);
end;
$$;

-- ---------------------------------------------------------------------------
-- Verificar el código (cuenta intentos, valida caducidad)
-- ---------------------------------------------------------------------------
create or replace function public.verify_password_reset(p_email text, p_code_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.password_resets;
  v_hour_attempts int;
begin
  -- Tope global de fallos por correo: 10 por hora aunque se pidan códigos
  -- nuevos. Evita fuerza bruta sostenida contra el código de 6 dígitos.
  select coalesce(sum(attempts), 0) into v_hour_attempts
    from public.password_resets
   where email = lower(btrim(p_email))
     and created_at > now() - interval '1 hour';
  if v_hour_attempts >= 10 then
    update public.password_resets
       set used_at = now()
     where email = lower(btrim(p_email)) and used_at is null;
    return jsonb_build_object('ok', false, 'error', 'too_many_attempts');
  end if;

  select * into v_row
    from public.password_resets
   where email = lower(btrim(p_email)) and used_at is null
   order by created_at desc
   limit 1
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  if v_row.expires_at < now() then
    update public.password_resets set used_at = now() where id = v_row.id;
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  if v_row.attempts >= 5 then
    update public.password_resets set used_at = now() where id = v_row.id;
    return jsonb_build_object('ok', false, 'error', 'too_many_attempts');
  end if;

  if v_row.code_hash <> p_code_hash then
    update public.password_resets set attempts = attempts + 1 where id = v_row.id;
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  return jsonb_build_object('ok', true, 'resetId', v_row.id, 'userId', v_row.user_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Consumir el código (un solo uso, atómico)
-- ---------------------------------------------------------------------------
create or replace function public.consume_password_reset(p_reset_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update public.password_resets
     set used_at = now()
   where id = p_reset_id and used_at is null;
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos: solo service_role
-- ---------------------------------------------------------------------------
revoke all on function public.find_user_by_email(text) from public, anon, authenticated;
revoke all on function public.create_password_reset(uuid,text,text,int,text) from public, anon, authenticated;
revoke all on function public.verify_password_reset(text,text) from public, anon, authenticated;
revoke all on function public.consume_password_reset(uuid) from public, anon, authenticated;

grant execute on function public.find_user_by_email(text) to service_role;
grant execute on function public.create_password_reset(uuid,text,text,int,text) to service_role;
grant execute on function public.verify_password_reset(text,text) to service_role;
grant execute on function public.consume_password_reset(uuid) to service_role;
