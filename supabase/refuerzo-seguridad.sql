-- ===========================================================================
-- PASION MOTORS · REFUERZO DE SEGURIDAD E INTEGRIDAD
-- ---------------------------------------------------------------------------
-- Ejecuta TODO este archivo en Supabase → SQL Editor DESPUÉS de:
--   schema.sql → pagos.sql → compras-seguras.sql → admin.sql → ...
--
-- Es idempotente: puedes ejecutarlo varias veces sin perder datos.
--
-- Qué refuerza:
--   1) Los pedidos ya no se pueden borrar desde la web (solo service_role).
--   2) Los importes/estado de un pedido solo los cambia el servidor de pagos.
--   3) Registro de auditoría de cada pedido (creación, cambios y borrados).
--   4) Guardado transaccional del catálogo (producto + imágenes + variantes).
--   5) Aceptación de términos y política de datos guardada en el pedido.
--   6) Límite antiabuso en el checkout (por correo y por IP).
--   7) La confirmación pública deja de exponer datos personales.
--   8) Car Spotting: solo imágenes reales y de tamaño razonable.
--   9) Incidencias de pago registradas para revisión manual.
--  10) Los roles solo los cambia un admin o el servidor (nunca el propio usuario).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Columnas nuevas en orders
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists terms_accepted_at timestamptz;
alter table public.orders add column if not exists terms_version   text;
alter table public.orders add column if not exists checkout_ip_hash text;

create index if not exists orders_ip_idx
  on public.orders (checkout_ip_hash, created_at desc)
  where checkout_ip_hash is not null;

create index if not exists orders_pending_email_idx
  on public.orders (lower(customer_email), created_at desc)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- 2. Auditoría de pedidos
-- ---------------------------------------------------------------------------
create table if not exists public.order_events (
  id          bigserial primary key,
  order_id    uuid not null,
  event       text not null,
  from_status text,
  to_status   text,
  actor       uuid,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists order_events_order_idx
  on public.order_events (order_id, created_at desc);

alter table public.order_events enable row level security;

drop policy if exists order_events_admin_read on public.order_events;
create policy order_events_admin_read on public.order_events
  for select to authenticated using (public.is_admin());

revoke all on public.order_events from anon, authenticated;
grant select on public.order_events to authenticated;

create or replace function public.log_order_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_events (order_id, event, to_status, actor, detail)
    values (new.id, 'created', new.status, auth.uid(),
            jsonb_build_object('total', new.total, 'count', new.count, 'email', new.customer_email));
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status
       or new.total is distinct from old.total
       or new.tracking_number is distinct from old.tracking_number then
      insert into public.order_events (order_id, event, from_status, to_status, actor, detail)
      values (
        new.id,
        case
          when new.status is distinct from old.status then 'status_changed'
          when new.total is distinct from old.total then 'total_changed'
          else 'tracking_changed'
        end,
        old.status, new.status, auth.uid(),
        jsonb_build_object(
          'total_before', old.total,
          'total_after', new.total,
          'tracking_before', old.tracking_number,
          'tracking_after', new.tracking_number
        )
      );
    end if;
  elsif tg_op = 'DELETE' then
    insert into public.order_events (order_id, event, from_status, actor, detail)
    values (old.id, 'deleted', old.status, auth.uid(),
            jsonb_build_object('total', old.total, 'count', old.count, 'email', old.customer_email));
  end if;
  return null;
end;
$$;

drop trigger if exists orders_audit on public.orders;
create trigger orders_audit
  after insert or update or delete on public.orders
  for each row execute function public.log_order_event();

-- ---------------------------------------------------------------------------
-- 3. Los importes y el estado solo los cambia el servidor
--    (un admin puede editar seguimiento y dirección, pero no cobrar/marcar pagado)
-- ---------------------------------------------------------------------------
create or replace function public.protect_order_financials()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Las funciones internas de confianza (cancelación de un pendiente, expiración
  -- de reservas) marcan la transacción para poder escribir el estado.
  if coalesce(current_setting('pm.order_write', true), '') = 'on' then
    return new;
  end if;

  -- Las peticiones del navegador llegan con el rol «authenticated» en el JWT.
  -- No se usa current_user porque dentro de una función SECURITY DEFINER
  -- siempre es el dueño de la función (postgres) y el control no se aplicaría.
  if coalesce(auth.role(), '') <> 'authenticated' then
    return new;
  end if;

  if new.status              is distinct from old.status
     or new.subtotal         is distinct from old.subtotal
     or new.total            is distinct from old.total
     or new.count            is distinct from old.count
     or new.currency         is distinct from old.currency
     or new.paid_at          is distinct from old.paid_at
     or new.provider         is distinct from old.provider
     or new.provider_payment_id is distinct from old.provider_payment_id
     or new.idempotency_key  is distinct from old.idempotency_key
     or new.stock_released_at is distinct from old.stock_released_at
     or new.user_id          is distinct from old.user_id
     or new.created_at       is distinct from old.created_at
  then
    raise exception 'Los importes y el estado del pedido solo puede modificarlos el servidor de pagos.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_protect_financials on public.orders;
create trigger orders_protect_financials
  before update on public.orders
  for each row execute function public.protect_order_financials();

-- Los pedidos son registros contables: nadie desde el navegador puede borrarlos.
drop policy if exists orders_admin_delete on public.orders;
revoke delete on public.orders from anon, authenticated;

-- Cancelar un pedido pendiente (libera stock) es la única «salida» permitida.
create or replace function public.admin_cancel_pending_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_order.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'not_pending', 'status', v_order.status);
  end if;

  -- Autoriza las escrituras internas de esta función de confianza: liberar el
  -- stock también marca `stock_released_at` en el pedido, y eso lo bloquea el
  -- trigger para las peticiones del navegador.
  perform set_config('pm.order_write', 'on', true);
  perform public.release_order_stock(v_order.id, false);
  update public.orders set status = 'cancelled' where id = v_order.id;
  perform set_config('pm.order_write', '', true);

  return jsonb_build_object('ok', true, 'status', 'cancelled');
end;
$$;

revoke all on function public.admin_cancel_pending_order(uuid) from public, anon;
grant execute on function public.admin_cancel_pending_order(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Guardado transaccional del catálogo
--    Antes el navegador hacía upsert + borrados + inserciones por separado:
--    si algo fallaba, el producto quedaba a medias. Ahora es UNA transacción.
-- ---------------------------------------------------------------------------
create or replace function public._save_product(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      uuid;
  v_slug    text := nullif(left(btrim(coalesce(p->>'slug', '')), 120), '');
  v_name    text := nullif(left(btrim(coalesce(p->>'name', '')), 200), '');
  v_cat     text := nullif(btrim(coalesce(p->>'category_id', '')), '');
  v_price   numeric(12,2);
  v_cost    numeric(12,2);
  v_compare numeric(12,2);
  v_stock   int;
  v_stock_expected int;
  v_current_stock  int;
  v_avail   text := coalesce(nullif(btrim(coalesce(p->>'availability', '')), ''), 'pendiente');
  v_variant jsonb;
  v_vid     uuid;
  v_ord     int;
begin
  v_id := case
            when coalesce(p->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then (p->>'id')::uuid
            else gen_random_uuid()
          end;

  if v_slug is null then raise exception 'El producto necesita un slug.'; end if;
  if v_name is null then raise exception 'El producto necesita un nombre.'; end if;
  if v_cat is null or not exists (select 1 from public.categories where id = v_cat) then
    raise exception 'La categoría del producto no existe.';
  end if;
  if v_avail not in ('disponible', 'agotado', 'pendiente') then
    raise exception 'Disponibilidad no válida: %.', v_avail;
  end if;

  v_price := case when nullif(btrim(coalesce(p->>'price', '')), '') is null then null
                  else (p->>'price')::numeric(12,2) end;
  v_cost := case when nullif(btrim(coalesce(p->>'cost', '')), '') is null then null
                 else (p->>'cost')::numeric(12,2) end;
  v_compare := case when nullif(btrim(coalesce(p->>'compare_at_price', '')), '') is null then null
                    else (p->>'compare_at_price')::numeric(12,2) end;
  v_stock := case when nullif(btrim(coalesce(p->>'stock', '')), '') is null then null
                  else (p->>'stock')::int end;
  v_stock_expected := case when nullif(btrim(coalesce(p->>'stock_expected', '')), '') is null then null
                           else (p->>'stock_expected')::int end;

  if v_price is not null and v_price < 0 then raise exception 'El precio no puede ser negativo.'; end if;
  if v_cost is not null and v_cost < 0 then raise exception 'El costo no puede ser negativo.'; end if;
  if v_compare is not null and v_compare < 0 then raise exception 'El precio anterior no puede ser negativo.'; end if;
  if v_stock is not null and v_stock < 0 then raise exception 'El stock no puede ser negativo.'; end if;

  -- Si el administrador no modificó el stock (el valor enviado coincide con el
  -- que cargó al abrir el producto), se conserva el stock actual de la base.
  -- Así una venta ocurrida mientras editaba no se sobrescribe con un valor viejo.
  select stock into v_current_stock
    from public.products where id = v_id for update;

  if found and v_stock is not null and v_stock_expected is not null
     and v_stock = v_stock_expected then
    v_stock := v_current_stock;
  end if;

  insert into public.products (
    id, slug, name, category_id, price, cost, compare_at_price, availability,
    stock, sold, tagline, description, badge, featured, featured_order,
    best_seller, best_seller_order, is_new, sort_order
  ) values (
    v_id, v_slug, v_name, v_cat, v_price, v_cost, v_compare, v_avail,
    v_stock, 0,
    nullif(left(coalesce(p->>'tagline', ''), 300), ''),
    nullif(left(coalesce(p->>'description', ''), 4000), ''),
    nullif(left(coalesce(p->>'badge', ''), 60), ''),
    coalesce((p->>'featured')::boolean, false),
    coalesce((p->>'featured_order')::int, 0),
    coalesce((p->>'best_seller')::boolean, false),
    coalesce((p->>'best_seller_order')::int, 0),
    coalesce((p->>'is_new')::boolean, false),
    coalesce((p->>'sort_order')::int, 0)
  )
  on conflict (id) do update set
    slug              = excluded.slug,
    name              = excluded.name,
    category_id       = excluded.category_id,
    price             = excluded.price,
    cost              = excluded.cost,
    compare_at_price  = excluded.compare_at_price,
    availability      = excluded.availability,
    stock             = excluded.stock,
    -- `sold` NO se toca: es un contador de ventas reales.
    tagline           = excluded.tagline,
    description       = excluded.description,
    badge             = excluded.badge,
    featured          = excluded.featured,
    featured_order    = excluded.featured_order,
    best_seller       = excluded.best_seller,
    best_seller_order = excluded.best_seller_order,
    is_new            = excluded.is_new,
    sort_order        = excluded.sort_order;

  -- Imágenes (se reemplazan por completo, dentro de la misma transacción).
  delete from public.product_images where product_id = v_id;
  insert into public.product_images (product_id, url, position)
  select v_id, left(btrim(value), 2000), (ord - 1)::int
    from jsonb_array_elements_text(
           case when jsonb_typeof(p->'images') = 'array' then p->'images' else '[]'::jsonb end
         ) with ordinality as t(value, ord)
   where btrim(value) <> '';

  -- Variantes y sus opciones.
  delete from public.product_variants where product_id = v_id;
  if jsonb_typeof(p->'variants') = 'array' then
    for v_variant, v_ord in
      select value, ord from jsonb_array_elements(p->'variants') with ordinality as t(value, ord)
    loop
      if nullif(btrim(coalesce(v_variant->>'name', '')), '') is null then
        continue;
      end if;
      insert into public.product_variants (product_id, name, position)
      values (v_id, left(btrim(v_variant->>'name'), 60), (v_ord - 1)::int)
      returning id into v_vid;

      insert into public.product_variant_options (variant_id, label, position)
      select v_vid, left(btrim(value), 60), (o - 1)::int
        from jsonb_array_elements_text(
               case when jsonb_typeof(v_variant->'options') = 'array'
                    then v_variant->'options' else '[]'::jsonb end
             ) with ordinality as t2(value, o)
       where btrim(value) <> '';
    end loop;
  end if;

  -- Especificaciones.
  delete from public.product_specs where product_id = v_id;
  insert into public.product_specs (product_id, label, value, position)
  select v_id,
         left(btrim(value->>'label'), 80),
         left(btrim(value->>'value'), 200),
         (ord - 1)::int
    from jsonb_array_elements(
           case when jsonb_typeof(p->'specs') = 'array' then p->'specs' else '[]'::jsonb end
         ) with ordinality as t(value, ord)
   where btrim(coalesce(value->>'label', '')) <> '';

  return v_id;
exception
  when unique_violation then
    raise exception 'Ya existe un producto con el slug «%». Cambia el slug o el nombre.', v_slug;
end;
$$;

create or replace function public.save_product(p_product jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_stock int;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'No autorizado.');
  end if;
  if p_product is null or jsonb_typeof(p_product) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'Datos del producto no válidos.');
  end if;

  v_id := public._save_product(p_product);

  -- Se devuelve el stock real guardado (puede diferir del enviado si hubo
  -- ventas mientras el administrador editaba).
  select stock into v_stock from public.products where id = v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'stock', v_stock);
exception
  when others then
    -- El bloque EXCEPTION revierte todo lo escrito en esta transacción.
    return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

create or replace function public.replace_catalog(p_products jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item  jsonb;
  v_count int := 0;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'No autorizado.');
  end if;
  if jsonb_typeof(p_products) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'El catálogo no es una lista válida.');
  end if;
  if jsonb_array_length(p_products) = 0 then
    return jsonb_build_object('ok', false, 'error', 'El catálogo no puede quedar vacío.');
  end if;
  if jsonb_array_length(p_products) > 500 then
    return jsonb_build_object('ok', false, 'error', 'El catálogo supera el máximo de 500 productos.');
  end if;

  delete from public.products;

  for v_item in select value from jsonb_array_elements(p_products) loop
    perform public._save_product(v_item);
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('ok', true, 'count', v_count);
exception
  when others then
    -- Si un producto falla, se revierte también el borrado del catálogo.
    return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

revoke all on function public._save_product(jsonb) from public, anon, authenticated;
revoke all on function public.save_product(jsonb) from public, anon;
revoke all on function public.replace_catalog(jsonb) from public, anon;
grant execute on function public.save_product(jsonb) to authenticated;
grant execute on function public.replace_catalog(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Checkout: términos + límite antiabuso
--    Se conserva la lógica original en create_order_base y se envuelve.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.create_order(jsonb)') is not null
     and to_regprocedure('public.create_order_base(jsonb)') is null then
    alter function public.create_order(jsonb) rename to create_order_base;
  end if;
end $$;

create or replace function public.create_order(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email    text := lower(left(btrim(coalesce(p_payload->'customer'->>'email', '')), 200));
  v_terms    boolean := lower(coalesce(p_payload->>'termsAccepted', 'false')) in ('true', 't', '1', 'yes');
  v_version  text := left(btrim(coalesce(p_payload->>'termsVersion', '')), 40);
  v_ip       text := nullif(left(coalesce(p_payload->>'checkoutIpHash', ''), 64), '');
  v_idem     text := nullif(btrim(coalesce(p_payload->>'idempotencyKey', '')), '');
  v_existing uuid;
  v_recent   int;
  v_ip_recent int;
  v_result   jsonb;
  v_order_id uuid;
begin
  -- Reintentos con la misma clave: devolver el pedido ya creado, sin límites.
  if v_idem is not null then
    select id into v_existing from public.orders where idempotency_key = v_idem limit 1;
    if found then
      return public.order_result(v_existing, true);
    end if;
  end if;

  if not v_terms then
    return jsonb_build_object('ok', false, 'error', 'terms_required');
  end if;

  -- Evita que una sola persona bloquee el inventario con pedidos pendientes.
  if v_email <> '' then
    select count(*) into v_recent
      from public.orders
     where lower(customer_email) = v_email
       and status = 'pending'
       and created_at > now() - interval '20 minutes';
    if v_recent >= 3 then
      return jsonb_build_object('ok', false, 'error', 'rate_limited');
    end if;
  end if;

  if v_ip is not null then
    select count(*) into v_ip_recent
      from public.orders
     where checkout_ip_hash = v_ip
       and created_at > now() - interval '30 minutes';
    if v_ip_recent >= 10 then
      return jsonb_build_object('ok', false, 'error', 'rate_limited');
    end if;
  end if;

  v_result := public.create_order_base(p_payload);

  if coalesce((v_result->>'ok')::boolean, false) then
    v_order_id := (v_result->'order'->>'id')::uuid;
    update public.orders
       set terms_accepted_at = now(),
           terms_version = v_version,
           checkout_ip_hash = v_ip
     where id = v_order_id;
  end if;

  return v_result;
end;
$$;

do $$
begin
  if to_regprocedure('public.create_order_base(jsonb)') is not null then
    execute 'revoke all on function public.create_order_base(jsonb) from public, anon, authenticated';
  end if;
end $$;

revoke all on function public.create_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_order(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 6. Confirmación de compra sin datos personales para terceros
--    El comprador (sesión) o un admin sí ven el nombre; un enlace filtrado no.
-- ---------------------------------------------------------------------------
create or replace function public.get_order_confirmation(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', o.id,
    'status', o.status,
    'created_at', o.created_at,
    'customer_name', case
      when o.user_id = auth.uid()
        or lower(o.customer_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        or public.is_admin()
        or auth.role() = 'service_role'
      then o.customer_name
      else null
    end,
    'customer_city', case
      when o.user_id = auth.uid()
        or lower(o.customer_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        or public.is_admin()
        or auth.role() = 'service_role'
      then o.customer_city
      else null
    end,
    'subtotal', o.subtotal,
    'total', o.total,
    'count', o.count,
    'currency', o.currency,
    'tracking_number', o.tracking_number,
    'tracking_carrier', o.tracking_carrier,
    'tracking_url', o.tracking_url,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', oi.name,
        'qty', oi.qty,
        'price', oi.price,
        'selections', oi.selections
      ) order by oi.name)
      from public.order_items oi where oi.order_id = o.id
    ), '[]'::jsonb),
    'gifts', coalesce((
      select jsonb_agg(og.name)
      from public.order_gifts og where og.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  where o.id = p_order_id;
$$;

revoke all on function public.get_order_confirmation(uuid) from public;
grant execute on function public.get_order_confirmation(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Car Spotting: solo imágenes reales y acotadas
-- ---------------------------------------------------------------------------
update storage.buckets
   set file_size_limit = 15728640,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif']
 where id in ('spots', 'product-images');

drop policy if exists storage_spots_insert on storage.objects;
create policy storage_spots_insert on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'spots'
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'avif', 'heic', 'heif')
  );

drop policy if exists spots_anyone_insert on public.spots;
create policy spots_anyone_insert on public.spots
  for insert to anon, authenticated
  with check (
    image ~* '^https?://'
    and char_length(image) <= 2000
    and char_length(coalesce(car, '')) <= 120
    and char_length(coalesce(location, '')) <= 120
    and char_length(coalesce(author, '')) <= 80
    and (user_id is null or user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 8. Incidencias de pago (pago aprobado sin stock, monto distinto, etc.)
-- ---------------------------------------------------------------------------
create table if not exists public.payment_issues (
  id         bigserial primary key,
  order_id   uuid,
  provider   text,
  payment_id text,
  reference  text,
  amount     numeric(12,2),
  currency   text,
  status     text,
  error      text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists payment_issues_created_idx
  on public.payment_issues (created_at desc);

alter table public.payment_issues enable row level security;

drop policy if exists payment_issues_admin_read on public.payment_issues;
create policy payment_issues_admin_read on public.payment_issues
  for select to authenticated using (public.is_admin());

drop policy if exists payment_issues_admin_update on public.payment_issues;
create policy payment_issues_admin_update on public.payment_issues
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.payment_issues from anon, authenticated;
grant select, update on public.payment_issues to authenticated;

create or replace function public.log_payment_issue(
  p_order_id   uuid,
  p_provider   text,
  p_payment_id text,
  p_reference  text,
  p_amount     numeric,
  p_currency   text,
  p_status     text,
  p_error      text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.payment_issues
    (order_id, provider, payment_id, reference, amount, currency, status, error)
  values
    (p_order_id, p_provider, p_payment_id, p_reference, p_amount, p_currency, p_status, p_error);
$$;

revoke all on function public.log_payment_issue(uuid, text, text, text, numeric, text, text, text)
  from public, anon, authenticated;
grant execute on function public.log_payment_issue(uuid, text, text, text, numeric, text, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 9. Roles: solo un admin (o el servidor) puede cambiarlos
--    Además se impide que un usuario cree su propio perfil como administrador.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Las peticiones del navegador llegan con el rol «authenticated» en el JWT.
  -- No se usa current_user porque dentro de una función SECURITY DEFINER
  -- siempre es el dueño de la función (postgres).
  if coalesce(auth.role(), '') <> 'authenticated' or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role := 'user';
  elsif new.role is distinct from old.role then
    new.role := old.role;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_change on public.profiles;
create trigger profiles_prevent_role_change
  before insert or update on public.profiles
  for each row execute function public.prevent_role_change();

-- Un usuario solo puede insertar su propio perfil, y siempre como cliente.
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid() and role = 'user');

-- ---------------------------------------------------------------------------
-- 10. Comprobación rápida
-- ---------------------------------------------------------------------------
select
  (select count(*) from public.orders where status = 'paid')            as pedidos_pagados,
  (select count(*) from public.orders where terms_accepted_at is null)  as pedidos_sin_terminos,
  (select count(*) from public.payment_issues where resolved_at is null) as incidencias_pago_abiertas,
  (select count(*) from public.order_events)                            as eventos_auditoria;
