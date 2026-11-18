-- ============================================================================
--  PASION MOTORS Â· Esquema completo para Supabase (PostgreSQL)
-- ============================================================================
--  CÃ³mo usarlo:
--   1. Entra a tu proyecto en https://supabase.com â†’ "SQL Editor" â†’ "New query".
--   2. Pega TODO este archivo y pulsa "Run".
--   3. Ve a Authentication â†’ Users y crea el usuario administrador
--      (email: admin@pasionmotors.com). DespuÃ©s ejecuta al final del script
--      la lÃ­nea marcada como [PASO FINAL] para darle rol de admin.
--
--  Este script es idempotente: puedes ejecutarlo mÃ¡s de una vez sin romper nada.
--  Cubre TODAS las secciones de la app:
--   Â· CatÃ¡logo (categorÃ­as, productos, imÃ¡genes, variantes, especificaciones)
--   Â· Ajustes del sitio (identidad, moneda, envÃ­o gratis, textos del inicio)
--   Â· Regalos del pedido y Promociones de envÃ­o
--   Â· Car Spotting (comunidad) con moderaciÃ³n
--   Â· Cuentas (Supabase Auth) con perfiles y roles admin/user
--   Â· Pedidos, Ã­tems de pedido y regalos incluidos
--   Â· Inventario transaccional (funciÃ³n commit_sale)
--   Â· Seguridad por filas (RLS) y Storage para imÃ¡genes
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensiones
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;      -- gen_random_uuid()
create extension if not exists "uuid-ossp";   -- compatibilidad

-- ---------------------------------------------------------------------------
-- 1. FunciÃ³n utilitaria: actualizar updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===========================================================================
-- 2. CATÃLOGO
-- ===========================================================================

-- CategorÃ­as (los id coinciden con la app: camisetas / accesorios / coleccionables)
create table if not exists public.categories (
  id          text primary key,
  name        text not null,
  short       text,
  description text,
  image       text,
  accent      text default '#FF1E2D',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

-- Productos
create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  name             text not null,
  category_id      text not null references public.categories(id) on update cascade on delete restrict,
  price            numeric(12,2),                      -- null = "Precio por confirmar"
  cost             numeric(12,2),                      -- costo unitario (para mÃ¡rgenes)
  compare_at_price numeric(12,2),                      -- precio anterior (si hay descuento real)
  availability     text not null default 'pendiente'
                   check (availability in ('disponible','agotado','pendiente')),
  stock            int,                                -- null = sin control de inventario
  sold             int not null default 0,
  tagline          text,
  description      text,
  badge            text,
  featured         boolean not null default false,
  featured_order   int not null default 0,
  best_seller      boolean not null default false,
  best_seller_order int not null default 0,
  is_new           boolean not null default false,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_featured_idx on public.products (featured, featured_order);
create index if not exists products_best_seller_idx on public.products (best_seller, best_seller_order);
create index if not exists products_sort_idx     on public.products (sort_order);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ImÃ¡genes de producto (una fila por imagen; position 0 = principal)
create table if not exists public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url        text not null,
  position   int  not null default 0
);
create index if not exists product_images_product_idx on public.product_images (product_id, position);

-- Variantes (ej. "Talla")
create table if not exists public.product_variants (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name       text not null,
  position   int  not null default 0
);
create unique index if not exists product_variants_product_name_key
  on public.product_variants (product_id, name);

-- Opciones de cada variante (ej. S, M, L, XL)
create table if not exists public.product_variant_options (
  id         uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  label      text not null,
  position   int  not null default 0
);
create unique index if not exists product_variant_options_variant_label_key
  on public.product_variant_options (variant_id, label);

-- Especificaciones (pares caracterÃ­stica/valor)
create table if not exists public.product_specs (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  label      text not null,
  value      text not null,
  position   int  not null default 0
);
create index if not exists product_specs_product_idx on public.product_specs (product_id, position);

-- ===========================================================================
-- 3. AJUSTES DEL SITIO (fila Ãºnica)
-- ===========================================================================
create table if not exists public.site_settings (
  id                   int primary key default 1 check (id = 1),
  name                 text not null default 'PASION MOTORS',
  tagline              text default 'DRIVE THE PASSION',
  currency             text not null default 'COP',
  locale               text not null default 'es-CO',
  whatsapp             text,
  email                text,
  instagram            text,
  tiktok               text,
  city                 text,
  free_shipping_from   numeric(12,2),
  min_order            numeric(12,2) default 24900,
  hero_image           text,
  featured_eyebrow     text default 'SelecciÃ³n',
  featured_title       text default 'Piezas destacadas',
  featured_description text default 'Los favoritos de la comunidad. Desliza para recorrer la colecciÃ³n.',
  garage               jsonb not null default '[]'::jsonb,
  legal_updated_at     date default '2026-10-27',
  updated_at           timestamptz not null default now()
);

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 4. REGALOS DEL PEDIDO
-- ===========================================================================
create table if not exists public.gifts (
  id          text primary key,
  name        text not null,
  description text,
  enabled     boolean not null default true,
  sort_order  int not null default 0
);

-- ===========================================================================
-- 5. PROMOCIONES DE ENVÃO
-- ===========================================================================
create table if not exists public.promos (
  id         text primary key,
  kind       text not null check (kind in ('shirt','amount')),
  title      text not null,
  message    text,
  amount     numeric(12,2),
  enabled    boolean not null default true,
  sort_order int not null default 0
);

-- ===========================================================================
-- 6. CAR SPOTTING (comunidad)
-- ===========================================================================
create table if not exists public.spots (
  id         uuid primary key default gen_random_uuid(),
  image      text not null,                          -- data URL o URL pÃºblica
  car        text,
  location   text,
  author     text,
  user_id    uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists spots_created_idx on public.spots (created_at desc);

-- ===========================================================================
-- 7. CUENTAS Â· PERFILES (enlazados a Supabase Auth)
-- ===========================================================================
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text,
  email      text,
  role       text not null default 'user' check (role in ('admin','user')),
  created_at timestamptz not null default now()
);

-- Â¿El usuario actual es admin? (security definer para no chocar con RLS)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Crea el perfil automÃ¡ticamente al registrarse un usuario
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Impide que un usuario se auto-otorgue el rol admin
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_change on public.profiles;
create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

-- ===========================================================================
-- 8. PEDIDOS
-- ===========================================================================
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete set null,
  customer_name    text not null,
  customer_email   text not null,
  customer_phone   text,
  customer_document text,
  customer_city    text,
  customer_address text,
  notes            text,
  subtotal         numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0,
  count            int not null default 0,
  currency         text not null default 'COP',
  status           text not null default 'pending'
                     check (status in ('pending','paid','failed','refunded','expired','cancelled')),
  provider         text,
  provider_payment_id text,
  idempotency_key  text,
  paid_at          timestamptz,
  stock_released_at timestamptz,
  tracking_number  text,
  tracking_carrier text,
  tracking_url     text,
  shipped_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_user_idx    on public.orders (user_id);
create index if not exists orders_status_idx  on public.orders (status);
create unique index if not exists orders_idempotency_idx
  on public.orders (idempotency_key) where idempotency_key is not null;
create unique index if not exists orders_payment_idx
  on public.orders (provider, provider_payment_id) where provider_payment_id is not null;
create index if not exists orders_tracking_idx
  on public.orders (lower(tracking_number)) where tracking_number is not null;

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table if not exists public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name       text not null,
  qty        int not null default 1,
  price      numeric(12,2),
  selections jsonb not null default '{}'::jsonb
);
create index if not exists order_items_order_idx on public.order_items (order_id);

-- Regalos incluidos en un pedido (sin FK a gifts para conservar el histÃ³rico)
create table if not exists public.order_gifts (
  id       uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  gift_id  text,
  name     text
);
create index if not exists order_gifts_order_idx on public.order_gifts (order_id);

-- ===========================================================================
-- 8b. SEGUIMIENTO, SOLICITUDES DE PRODUCTOS Y BOLETÃN
-- ===========================================================================

-- Consulta pÃºblica de seguimiento (devuelve solo datos del envÃ­o, sin datos personales)
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

-- Solicitudes de productos agotados
create table if not exists public.restock_requests (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid references public.products(id) on delete set null,
  product_name     text not null,
  product_slug     text,
  product_category text,
  email            text not null,
  name             text,
  phone            text,
  qty              int not null default 1 check (qty between 1 and 99),
  notes            text,
  status           text not null default 'new'
                   check (status in ('new','contacted','ordered','restocked','closed')),
  user_id          uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists restock_requests_created_idx
  on public.restock_requests (created_at desc);
create index if not exists restock_requests_product_idx
  on public.restock_requests (product_id);
create unique index if not exists restock_requests_product_email_key
  on public.restock_requests (product_id, email);

drop trigger if exists restock_requests_updated_at on public.restock_requests;
create trigger restock_requests_updated_at
  before update on public.restock_requests
  for each row execute function public.set_updated_at();

create or replace function public.request_restock(
  p_product_id uuid,
  p_email      text,
  p_name       text default null,
  p_phone      text default null,
  p_qty        int default 1,
  p_notes      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email    text := lower(trim(coalesce(p_email, '')));
  v_name     text := nullif(left(btrim(coalesce(p_name, '')), 160), '');
  v_phone    text := nullif(left(btrim(coalesce(p_phone, '')), 40), '');
  v_notes    text := nullif(left(btrim(coalesce(p_notes, '')), 500), '');
  v_qty      int  := greatest(1, least(coalesce(p_qty, 1), 99));
  v_product  public.products;
  v_existing uuid;
begin
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(v_email) > 200 then
    return jsonb_build_object('ok', false, 'error', 'invalid_email');
  end if;

  select * into v_product from public.products where id = p_product_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'unknown_product');
  end if;

  if v_product.availability <> 'agotado'
     and (v_product.stock is null or v_product.stock > 0) then
    return jsonb_build_object('ok', false, 'error', 'available');
  end if;

  select id into v_existing
    from public.restock_requests
   where product_id = v_product.id and email = v_email
   limit 1;

  if v_existing is not null then
    update public.restock_requests
       set name = coalesce(v_name, name),
           phone = coalesce(v_phone, phone),
           qty = v_qty,
           notes = coalesce(v_notes, notes),
           user_id = coalesce(auth.uid(), user_id),
           status = case when status in ('restocked','closed') then 'new' else status end,
           updated_at = now()
     where id = v_existing;
    return jsonb_build_object('ok', true, 'status', 'existing');
  end if;

  insert into public.restock_requests (
    product_id, product_name, product_slug, product_category,
    email, name, phone, qty, notes, user_id
  ) values (
    v_product.id, v_product.name, v_product.slug, v_product.category_id,
    v_email, v_name, v_phone, v_qty, v_notes, auth.uid()
  );

  return jsonb_build_object('ok', true, 'status', 'new');
end;
$$;

create table if not exists public.newsletter_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  source     text default 'web',
  created_at timestamptz not null default now()
);
create unique index if not exists newsletter_subscribers_email_key
  on public.newsletter_subscribers (lower(email));

-- ===========================================================================
-- 9. INVENTARIO Â· Descuento transaccional de stock (evita sobreventa)
-- ===========================================================================
--  Recibe:  [{"productId":"<uuid>","qty":2}, ...]
--  Devuelve: {"ok":true,  "unavailable":[]}
--         o  {"ok":false, "unavailable":[{"productId","name","requested","available"}]}
create or replace function public.commit_sale(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item        jsonb;
  pid         uuid;
  qty         int;
  avail       int;
  avail_status text;
  pname       text;
  unavailable jsonb := '[]'::jsonb;
begin
  -- 1) Bloquea y valida cada producto
  for item in select * from jsonb_array_elements(p_items) loop
    pid := (item->>'productId')::uuid;
    qty := coalesce((item->>'qty')::int, 0);
    select stock, name, availability into avail, pname, avail_status
      from public.products where id = pid for update;
    if avail_status = 'agotado' or (avail is not null and avail < qty) then
      unavailable := unavailable || jsonb_build_object(
        'productId', pid,
        'name', coalesce(pname, ''),
        'requested', qty,
        'available', case when avail_status = 'agotado' then 0 else avail end
      );
    end if;
  end loop;

  if jsonb_array_length(unavailable) > 0 then
    return jsonb_build_object('ok', false, 'unavailable', unavailable);
  end if;

  -- 2) Aplica el descuento (solo a productos con control de stock)
  for item in select * from jsonb_array_elements(p_items) loop
    pid := (item->>'productId')::uuid;
    qty := coalesce((item->>'qty')::int, 0);
    update public.products
       set stock = greatest(0, stock - qty),
           sold  = sold + qty
     where id = pid and stock is not null;
  end loop;

  return jsonb_build_object('ok', true, 'unavailable', '[]'::jsonb);
end;
$$;

-- ===========================================================================
-- 10. SEGURIDAD POR FILAS (RLS)
-- ===========================================================================
alter table public.categories              enable row level security;
alter table public.products               enable row level security;
alter table public.product_images         enable row level security;
alter table public.product_variants       enable row level security;
alter table public.product_variant_options enable row level security;
alter table public.product_specs          enable row level security;
alter table public.site_settings          enable row level security;
alter table public.gifts                  enable row level security;
alter table public.promos                 enable row level security;
alter table public.spots                  enable row level security;
alter table public.profiles               enable row level security;
alter table public.orders                 enable row level security;
alter table public.order_items            enable row level security;
alter table public.order_gifts            enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.restock_requests      enable row level security;

-- ---- CatÃ¡logo: lectura pÃºblica, escritura solo admin ----
do $$
declare t text;
begin
  foreach t in array array[
    'categories','products','product_images','product_variants',
    'product_variant_options','product_specs','site_settings','gifts','promos'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_public_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_write', t);
    execute format('create policy %I on public.%I for select using (true)', t || '_public_read', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || '_admin_write', t
    );
  end loop;
end $$;

-- ---- Car Spotting ----
drop policy if exists spots_public_read on public.spots;
create policy spots_public_read on public.spots for select using (true);

drop policy if exists spots_anyone_insert on public.spots;
create policy spots_anyone_insert on public.spots
  for insert to anon, authenticated with check (true);

drop policy if exists spots_delete_own on public.spots;
create policy spots_delete_own on public.spots
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists spots_delete_admin on public.spots;
create policy spots_delete_admin on public.spots
  for delete to authenticated using (public.is_admin());

-- ---- Perfiles ----
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles
  for delete using (public.is_admin());

-- Un administrador puede editar perfiles de otros usuarios (cambiar rol, nombre)
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- Pedidos ----
-- Sin policy de INSERT: los pedidos los crea SOLO el servidor (service_role)
-- a travÃ©s de la Edge Function y la funciÃ³n create_order (ver supabase/pagos.sql).
drop policy if exists orders_anyone_insert on public.orders;

drop policy if exists orders_read_own_or_admin on public.orders;
create policy orders_read_own_or_admin on public.orders
  for select using (
    user_id = auth.uid()
    or lower(customer_email) = lower(auth.jwt() ->> 'email')
    or public.is_admin()
  );

drop policy if exists orders_admin_write on public.orders;
create policy orders_admin_write on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists orders_admin_delete on public.orders;
create policy orders_admin_delete on public.orders
  for delete using (public.is_admin());

-- ---- Ãtems y regalos del pedido ----
drop policy if exists order_items_anyone_insert on public.order_items;

drop policy if exists order_items_read on public.order_items;
create policy order_items_read on public.order_items
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
       where o.id = order_items.order_id
         and (o.user_id = auth.uid()
              or lower(o.customer_email) = lower(auth.jwt() ->> 'email'))
    )
  );

drop policy if exists order_gifts_anyone_insert on public.order_gifts;

drop policy if exists order_gifts_read on public.order_gifts;
create policy order_gifts_read on public.order_gifts
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
       where o.id = order_gifts.order_id
         and (o.user_id = auth.uid()
              or lower(o.customer_email) = lower(auth.jwt() ->> 'email'))
    )
  );

-- ---- BoletÃ­n ----
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

-- ---- Solicitudes de productos agotados ----
drop policy if exists restock_admin_read on public.restock_requests;
create policy restock_admin_read on public.restock_requests
  for select to authenticated using (public.is_admin());

drop policy if exists restock_admin_update on public.restock_requests;
create policy restock_admin_update on public.restock_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists restock_admin_delete on public.restock_requests;
create policy restock_admin_delete on public.restock_requests
  for delete to authenticated using (public.is_admin());

-- SuscripciÃ³n segura desde la web
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

-- ===========================================================================
-- 11. GRANTS (permisos base; RLS sigue filtrando el acceso)
-- ===========================================================================
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
-- Car Spotting permite invitados: inserciÃ³n anÃ³nima SOLO en spots.
-- Los pedidos los crea el servidor (service_role) vÃ­a supabase/pagos.sql.
grant insert on public.spots to anon;
grant insert on public.newsletter_subscribers to anon, authenticated;
grant select, delete on public.newsletter_subscribers to authenticated;
grant select, update, delete on public.restock_requests to authenticated;
grant execute on function public.is_admin() to anon, authenticated;
revoke all on function public.track_order(text) from public;
grant execute on function public.track_order(text) to anon, authenticated;
revoke all on function public.subscribe_newsletter(text, text) from public;
grant execute on function public.subscribe_newsletter(text, text) to anon, authenticated;
revoke all on function public.request_restock(uuid, text, text, text, int, text) from public;
grant execute on function public.request_restock(uuid, text, text, text, int, text) to anon, authenticated;

-- ===========================================================================
-- 12. STORAGE (buckets para imÃ¡genes)
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('spots', 'spots', true)
on conflict (id) do nothing;

-- Lectura pÃºblica de las imÃ¡genes
drop policy if exists storage_public_read on storage.objects;
create policy storage_public_read on storage.objects
  for select using (bucket_id in ('product-images','spots'));

-- Subida/gestiÃ³n de productos: solo admin
drop policy if exists storage_product_admin_write on storage.objects;
create policy storage_product_admin_write on storage.objects
  for all to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

-- Car Spotting: cualquiera puede subir
drop policy if exists storage_spots_insert on storage.objects;
create policy storage_spots_insert on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'spots');

drop policy if exists storage_spots_admin_delete on storage.objects;
create policy storage_spots_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'spots' and public.is_admin());

-- ===========================================================================
-- 13. DATOS SEMILLA (los que hoy trae la app)
-- ===========================================================================

-- CategorÃ­as
insert into public.categories (id, name, short, description, accent, sort_order) values
  ('camisetas',     'Camisetas',     'Camisetas',     'Prendas que declaran tu pasiÃ³n por los motores.',            '#FF1E2D', 1),
  ('accesorios',    'Accesorios',    'Accesorios',    'Detalles que transforman tu carro y tu experiencia al volante.', '#FF1E2D', 2),
  ('coleccionables','Coleccionables','Coleccionables','RÃ©plicas para atesorar y exhibir la leyenda del motor.',     '#FF1E2D', 3)
on conflict (id) do nothing;

-- Ajustes del sitio
insert into public.site_settings (
  id, name, tagline, currency, locale, email, instagram, tiktok, city,
  min_order, hero_image, featured_eyebrow, featured_title, featured_description
) values (
  1, 'PASION MOTORS', 'DRIVE THE PASSION', 'COP', 'es-CO',
  'mbordaborda@gmail.com', '@pasionmotors', '@pasionmotors', 'Colombia',
  24900,
  'https://images.pexels.com/photos/9113904/pexels-photo-9113904.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'SelecciÃ³n', 'Piezas destacadas', 'Los favoritos de la comunidad. Desliza para recorrer la colecciÃ³n.'
)
on conflict (id) do nothing;

-- Regalos
insert into public.gifts (id, name, description, enabled, sort_order) values
  ('gift-bolsa',          'Bolsa con logo',                            'Tu pedido llega en nuestra bolsa de marca, lista para regalar.',                  false, 1),
  ('gift-llavero',        'Llavero PASION MOTORS',                      'El detalle final: un llavero oficial de la marca.',                               false, 2),
  ('gift-sticker-redondo','Sticker redondo',                           'El emblema circular de PASION MOTORS para que formes parte de esta comunidad.',   true,  3),
  ('gift-stickers-cars',  '3 stickers de Culture of Cars',             'Stickers animados de autos para personalizar lo que quieras.',                    true,  4),
  ('gift-sticker-lamina', '1 sticker de lÃ¡mina para personalizar PASION MOTORS', 'Sticker de lÃ¡mina para personalizar tu PASION MOTORS.',                  true,  5)
on conflict (id) do nothing;

-- Promociones de envÃ­o
insert into public.promos (id, kind, title, message, amount, enabled, sort_order) values
  ('promo-shirt',  'shirt',  'EnvÃ­o gratis con tu camiseta', '', 17000, true, 1),
  ('promo-amount', 'amount', 'EnvÃ­o gratis por monto',       '', 99900, true, 2)
on conflict (id) do nothing;

-- Productos
insert into public.products
  (slug, name, category_id, price, cost, stock, sold, availability, tagline, description, featured, featured_order, is_new, sort_order)
values
  ('aleron-frente-carro','AlerÃ³n frente de carro','accesorios',29900,8822,1,0,'disponible','AerodinÃ¡mica y presencia frontal.','AlerÃ³n frontal para personalizar la parte delantera del vehÃ­culo. FotografÃ­a pendiente de confirmar.',true,1,false,1),
  ('protectores-de-hombro-negro','Protectores de hombro negro','accesorios',29900,18310,1,0,'disponible','ProtecciÃ³n y estilo dentro del habitÃ¡culo.','Protectores de hombro para cinturÃ³n en color negro.',false,0,false,2),
  ('porsche-burago-azul','Porsche Bburago azul','coleccionables',29900,19948,1,0,'disponible','ColecciÃ³n Burago.','Miniatura coleccionable Porsche Bburago en color azul.',false,0,false,3),
  ('porsche-burago-negro','Porsche Bburago negro','coleccionables',29900,19948,1,0,'disponible','ColecciÃ³n Burago.','Miniatura coleccionable Porsche Bburago en color negro.',false,0,false,4),
  ('llavero-rueda-negro-amarillo','Llavero rueda negro-amarillo','accesorios',16900,8721,1,0,'disponible','Detalle de rueda.','Llavero con forma de rueda en negro y amarillo.',false,0,false,5),
  ('camiseta-tokio','Camiseta Tokio','camisetas',45900,20714,1,0,'disponible','EstÃ©tica JDM.','Camiseta con diseÃ±o Tokio.',true,2,false,6),
  ('protectores-de-hombro-rojo','Protectores de hombro rojo','accesorios',29990,13506,1,0,'disponible','ProtecciÃ³n y estilo dentro del habitÃ¡culo.','Protectores de hombro para cinturÃ³n en color rojo.',false,0,false,7),
  ('soporte-silla-rojo-celular','Soporte silla rojo celular','accesorios',29990,12872,1,0,'disponible','Tu celular siempre a la vista.','Soporte de celular para silla en acabado rojo.',false,0,false,8),
  ('luces-led-interior-carro','Luces LED interior carro','accesorios',34900,15408,1,0,'disponible','Ambiente deportivo a bordo.','IluminaciÃ³n LED interior para personalizar el ambiente del vehÃ­culo.',false,0,true,9),
  ('sticker-frente-carro','Sticker frente carro','accesorios',24900,10435,1,0,'disponible','Detalle que habla por tu carro.','Sticker para la parte frontal del carro.',false,0,false,10),
  ('volante-fibra-de-carbono','Volante fibra de carbono','accesorios',59900,29982,1,0,'disponible','Textura racing al alcance de tus manos.','Volante con acabado en fibra de carbono.',true,3,false,11),
  ('llavero-rueda-plateado','Llavero rueda plateado','accesorios',16900,8721,1,0,'disponible','Acabado plateado.','Llavero con forma de rueda en plateado.',false,0,false,12),
  ('llavero-rueda-negro-rojo','Llavero rueda negro-rojo','accesorios',16900,6291,1,0,'disponible','Los colores de la marca.','Llavero con forma de rueda en negro y rojo.',true,4,false,13),
  ('camiseta-porsche-blanca','Camiseta Porsche blanca','camisetas',59900,23093,1,0,'disponible','ClÃ¡sico en blanco.','Camiseta Porsche en color blanco.',false,0,false,14),
  ('camiseta-porsche-negra-morado','Camiseta Porsche negra morado','camisetas',59900,23093,1,0,'disponible','Contraste atrevido.','Camiseta Porsche en negro con detalles morados.',false,0,false,15),
  ('camiseta-rays','Camiseta Rays','camisetas',59900,26350,1,0,'disponible','Estilo de rueda legendaria.','Camiseta Rays.',false,0,false,16),
  ('camiseta-rays-azul','Camiseta Rays azul','camisetas',59900,26350,1,0,'disponible','Rays en azul.','Camiseta Rays en color azul.',false,0,true,17),
  ('llaveros-variados','Llaveros variados','accesorios',7900,3536,8,0,'disponible','Surtidos para elegir.','SelecciÃ³n de llaveros variados.',false,0,false,18),
  ('llaveros-variados-promo','Llaveros variados promo','accesorios',7900,3059,8,0,'disponible','Pack promocional.','Pack promocional de llaveros variados.',false,0,false,19),
  ('camiseta-porsche-blanca-mujer','Camiseta Porsche blanca mujer','camisetas',59900,15982,1,0,'disponible','Corte mujer.','Camiseta Porsche blanca con corte de mujer.',false,0,false,20),
  ('camiseta-porsche-mujer-negra-rosa','Camiseta Porsche mujer negra rosa','camisetas',59900,22105,1,0,'disponible','Actitud en negro y rosa.','Camiseta Porsche para mujer en negro con detalles rosados.',false,0,false,21),
  ('camiseta-porsche-hombre-negra','Camiseta Porsche hombre negra','camisetas',59900,29925,1,0,'disponible','Corte hombre.','Camiseta Porsche negra con corte de hombre.',false,0,false,22),
  ('ford-mustang-burago','Ford Mustang Bburago','coleccionables',29900,19913,1,0,'disponible','Icono americano en miniatura.','Miniatura coleccionable Ford Mustang Bburago.',true,5,true,23),
  ('llavero-volante','Llavero volante','accesorios',12900,4900,25,0,'disponible','Detalle racing para tus llaves.','Llavero metÃ¡lico con forma de volante. El detalle perfecto para sumar a tu pedido.',false,0,true,24),
  ('llavero-turbo','Llavero turbo','accesorios',12900,4900,25,0,'disponible','Siente el soplido.','Llavero con diseÃ±o de turbina para los amantes de la potencia.',false,0,true,25),
  ('llavero-piston','Llavero pistÃ³n','accesorios',14900,5600,20,0,'disponible','IngenierÃ­a en miniatura.','Llavero metÃ¡lico inspirado en un pistÃ³n de motor.',false,0,false,26),
  ('llavero-casco','Llavero casco','accesorios',9900,3900,30,0,'disponible','Para llevar la pasiÃ³n a todas partes.','Llavero con forma de casco de carreras. Un detalle pequeÃ±o y fÃ¡cil de sumar.',false,0,true,27),
  ('sticker-pack-jdm','Pack stickers JDM','accesorios',9900,3200,40,0,'disponible','Personaliza tu carro o tu setup.','Pack de stickers con estÃ©tica JDM para personalizar lo que quieras.',false,0,false,28),
  ('sticker-logo-pasion-motors','Sticker logo PASION MOTORS','accesorios',6900,2100,50,0,'disponible','Lleva la marca contigo.','Sticker oficial de PASION MOTORS para vidrio, portÃ¡til o donde quieras.',false,0,true,29),
  ('parche-logo-pasion-motors','Parche logo PASION MOTORS','accesorios',11900,4300,35,0,'disponible','Detalle de marca para tu ropa.','Parche bordado con el logo de PASION MOTORS.',false,0,false,30)
on conflict (slug) do nothing;

-- Variantes "Talla" para todas las camisetas
insert into public.product_variants (product_id, name, position)
select id, 'Talla', 1
from public.products
where category_id = 'camisetas'
on conflict (product_id, name) do nothing;

-- Opciones base S, M, L, XL para cada variante
insert into public.product_variant_options (variant_id, label, position)
select v.id, opt.label, opt.pos
from public.product_variants v
cross join (values ('S',1),('M',2),('L',3),('XL',4)) as opt(label, pos)
on conflict (variant_id, label) do nothing;

-- Talla XS extra para camisetas de mujer
insert into public.product_variant_options (variant_id, label, position)
select v.id, 'XS', 0
from public.product_variants v
join public.products p on p.id = v.product_id
where p.slug in ('camiseta-porsche-blanca-mujer','camiseta-porsche-mujer-negra-rosa')
on conflict (variant_id, label) do nothing;

-- Talla XXL extra para camiseta de hombre
insert into public.product_variant_options (variant_id, label, position)
select v.id, 'XXL', 5
from public.product_variants v
join public.products p on p.id = v.product_id
where p.slug = 'camiseta-porsche-hombre-negra'
on conflict (variant_id, label) do nothing;

-- ===========================================================================
-- 14. REALTIME Â· SincronizaciÃ³n en vivo (opcional pero recomendada)
-- ===========================================================================
--  Publica las tablas en la publicaciÃ³n `supabase_realtime` para que la app se
--  actualice al instante cuando cambian datos (otra pestaÃ±a, otro dispositivo).
do $$
declare t text;
begin
  foreach t in array array[
    'products','product_images','product_variants','product_variant_options',
    'product_specs','site_settings','gifts','promos','spots','orders',
    'newsletter_subscribers','restock_requests'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;   -- ya estaba publicada
      when undefined_object then null;   -- la publicaciÃ³n no existe (proyecto sin realtime)
    end;
  end loop;
end $$;

-- ===========================================================================
-- [PASO FINAL] Crear tu usuario admin y luego ejecutar SOLO esta lÃ­nea:
--   (primero crea el usuario en Authentication â†’ Users â†’ Add user)
-- ===========================================================================
-- update public.profiles set role = 'admin' where email = 'admin@pasionmotors.com';

-- ===========================================================================
-- IMPORTANTE Â· PAGOS
--   DespuÃ©s de este archivo ejecuta tambiÃ©n `supabase/pagos.sql`, que aÃ±ade
--   las funciones seguras de pago (create_order, mark_order_payment, cancel_order)
--   y cierra la escritura pÃºblica de pedidos.
-- ===========================================================================