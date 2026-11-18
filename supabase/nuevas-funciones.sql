-- ===========================================================================
-- PASION MOTORS · ACTUALIZACIÓN 2026
-- ---------------------------------------------------------------------------
-- Ejecuta TODO este archivo en Supabase → SQL Editor.
-- Es idempotente: puedes volver a ejecutarlo sin perder datos.
--
-- Agrega lo necesario para:
--   · Seguimiento de pedidos: número de guía, transportadora y enlace.
--   · Consulta pública de seguimiento en la página de Envíos.
--   · Boletín (newsletter) de novedades.
--   · Correo de contacto configurable (mbordaborda@gmail.com por defecto).
--   · Productos pequeños (llaveros, stickers y parche) para sumar al carrito.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Seguimiento de pedidos
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists tracking_number text;
alter table public.orders add column if not exists tracking_carrier text;
alter table public.orders add column if not exists tracking_url text;
alter table public.orders add column if not exists shipped_at timestamptz;

create index if not exists orders_tracking_idx
  on public.orders (lower(tracking_number)) where tracking_number is not null;

-- ---------------------------------------------------------------------------
-- 2. Consulta pública de seguimiento (sin datos personales)
-- ---------------------------------------------------------------------------
create or replace function public.track_order(p_query text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'found', true,
    'id', o.id,
    'status', o.status,
    'count', o.count,
    'created_at', o.created_at,
    'tracking_number', o.tracking_number,
    'tracking_carrier', o.tracking_carrier,
    'tracking_url', o.tracking_url,
    'shipped_at', o.shipped_at
  )
  from public.orders o
  where lower(trim(coalesce(o.tracking_number, ''))) = lower(trim(coalesce(p_query, '')))
     or o.id::text = lower(trim(coalesce(p_query, '')))
     or (length(trim(coalesce(p_query, ''))) >= 8
         and o.id::text like lower(trim(p_query)) || '%')
  order by o.created_at desc
  limit 1;
$$;

revoke all on function public.track_order(text) from public;
grant execute on function public.track_order(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Boletín de novedades
-- ---------------------------------------------------------------------------
create table if not exists public.newsletter_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  source     text default 'web',
  created_at timestamptz not null default now()
);

create unique index if not exists newsletter_subscribers_email_key
  on public.newsletter_subscribers (lower(email));

alter table public.newsletter_subscribers enable row level security;

drop policy if exists newsletter_anyone_insert on public.newsletter_subscribers;
create policy newsletter_anyone_insert on public.newsletter_subscribers
  for insert to anon, authenticated
  with check (
    position('@' in email) > 1
    and length(email) <= 200
    and email = lower(trim(email))
  );

drop policy if exists newsletter_admin_read on public.newsletter_subscribers;
create policy newsletter_admin_read on public.newsletter_subscribers
  for select to authenticated using (public.is_admin());

drop policy if exists newsletter_admin_delete on public.newsletter_subscribers;
create policy newsletter_admin_delete on public.newsletter_subscribers
  for delete to authenticated using (public.is_admin());

grant insert on public.newsletter_subscribers to anon, authenticated;
grant select, delete on public.newsletter_subscribers to authenticated;

-- Suscripción segura desde la web (valida y evita duplicados sin exponer la tabla)
create or replace function public.subscribe_newsletter(p_email text, p_source text default 'web')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email    text := lower(trim(coalesce(p_email, '')));
  v_source   text := left(coalesce(nullif(trim(p_source), ''), 'web'), 40);
  v_inserted int := 0;
begin
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(v_email) > 200 then
    return jsonb_build_object('ok', false, 'error', 'invalid_email');
  end if;

  insert into public.newsletter_subscribers (email, source)
  values (v_email, v_source)
  on conflict (lower(email)) do nothing;

  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'ok', true,
    'status', case when v_inserted > 0 then 'new' else 'existing' end
  );
end;
$$;

revoke all on function public.subscribe_newsletter(text, text) from public;
grant execute on function public.subscribe_newsletter(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Correo público configurable
-- ---------------------------------------------------------------------------
insert into public.site_settings (id, email)
values (1, 'mbordaborda@gmail.com')
on conflict (id) do update
  set email = excluded.email
  where site_settings.email is null
     or site_settings.email = ''
     or site_settings.email = 'hola@pasionmotors.com';

-- ---------------------------------------------------------------------------
-- 6. Productos pequeños para sumar al carrito
-- ---------------------------------------------------------------------------
insert into public.products
  (slug, name, category_id, price, cost, stock, sold, availability, tagline, description, is_new, sort_order)
values
  ('llavero-volante', 'Llavero volante', 'accesorios', 12900, 4900, 25, 0, 'disponible', 'Detalle racing para tus llaves.', 'Llavero metálico con forma de volante. El detalle perfecto para sumar a tu pedido.', true, 24),
  ('llavero-turbo', 'Llavero turbo', 'accesorios', 12900, 4900, 25, 0, 'disponible', 'Siente el soplido.', 'Llavero con diseño de turbina para los amantes de la potencia.', true, 25),
  ('llavero-piston', 'Llavero pistón', 'accesorios', 14900, 5600, 20, 0, 'disponible', 'Ingeniería en miniatura.', 'Llavero metálico inspirado en un pistón de motor.', false, 26),
  ('llavero-casco', 'Llavero casco', 'accesorios', 9900, 3900, 30, 0, 'disponible', 'Para llevar la pasión a todas partes.', 'Llavero con forma de casco de carreras. Un detalle pequeño y fácil de sumar.', true, 27),
  ('sticker-pack-jdm', 'Pack stickers JDM', 'accesorios', 9900, 3200, 40, 0, 'disponible', 'Personaliza tu carro o tu setup.', 'Pack de stickers con estética JDM para personalizar lo que quieras.', false, 28),
  ('sticker-logo-pasion-motors', 'Sticker logo PASION MOTORS', 'accesorios', 6900, 2100, 50, 0, 'disponible', 'Lleva la marca contigo.', 'Sticker oficial de PASION MOTORS para vidrio, portátil o donde quieras.', true, 29),
  ('parche-logo-pasion-motors', 'Parche logo PASION MOTORS', 'accesorios', 11900, 4300, 35, 0, 'disponible', 'Detalle de marca para tu ropa.', 'Parche bordado con el logo de PASION MOTORS.', false, 30)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 7. Realtime para que el panel se actualice al instante
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'orders','newsletter_subscribers'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
      when undefined_object then null;
    end;
  end loop;
end $$;

-- Comprobación rápida
select
  (select count(*) from public.newsletter_subscribers) as suscriptores,
  (select count(*) from public.products) as productos;
