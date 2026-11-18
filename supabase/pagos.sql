-- ===========================================================================
-- PASION MOTORS Â· PAGOS SEGUROS (Mercado Pago)
-- ---------------------------------------------------------------------------
-- Ejecuta TODO este archivo en Supabase â†’ SQL Editor.
-- Es idempotente: puedes volver a ejecutarlo sin perder datos.
--
-- QuÃ© hace:
--   1) AÃ±ade estado y datos de pago a los pedidos.
--   2) Crea create_order():  el SERVIDOR calcula precios, total y stock.
--   3) Crea mark_order_payment(): confirma el pago de forma idempotente.
--   4) Crea cancel_order(): libera stock si la pasarela falla.
--   5) Cierra la escritura pÃºblica de pedidos (solo el servidor escribe).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Columnas de pago en orders
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists status text not null default 'pending';
alter table public.orders add column if not exists currency text not null default 'COP';
alter table public.orders add column if not exists total numeric(12,2) not null default 0;
alter table public.orders add column if not exists provider text;
alter table public.orders add column if not exists provider_payment_id text;
alter table public.orders add column if not exists idempotency_key text;
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists updated_at timestamptz not null default now();
alter table public.orders add column if not exists customer_document text;
alter table public.orders add column if not exists stock_released_at timestamptz;

do $$
begin
  alter table public.orders drop constraint if exists orders_status_check;
  alter table public.orders add constraint orders_status_check
    check (status in ('pending','paid','failed','refunded','expired','cancelled'));
end $$;

create unique index if not exists orders_idempotency_idx
  on public.orders (idempotency_key) where idempotency_key is not null;
create index if not exists orders_status_idx on public.orders (status);
create unique index if not exists orders_payment_idx
  on public.orders (provider, provider_payment_id) where provider_payment_id is not null;

-- Pedidos antiguos: completar el total con su subtotal.
update public.orders set total = subtotal where total = 0 and subtotal > 0;

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 1b. Inventario seguro: liberar reservas y expirar pedidos pendientes
-- ---------------------------------------------------------------------------
-- Libera el stock reservado por un pedido una sola vez (idempotente).
-- p_reverse_sold = true se usa cuando un pedido ya pagado se reembolsa.
create or replace function public.release_order_stock(
  p_order_id uuid,
  p_reverse_sold boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_row   record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then return false; end if;
  if v_order.stock_released_at is not null then return false; end if;

  for v_row in
    select product_id, sum(qty)::int as qty
      from public.order_items
     where order_id = p_order_id and product_id is not null
     group by product_id
  loop
    update public.products
       set stock = case when stock is not null then stock + v_row.qty else stock end,
           sold  = case when p_reverse_sold then greatest(0, sold - v_row.qty) else sold end
     where id = v_row.product_id;
  end loop;

  update public.orders set stock_released_at = now() where id = p_order_id;
  return true;
end;
$$;

-- Expira pedidos pendientes antiguos y devuelve el stock a la tienda.
create or replace function public.expire_pending_orders(p_minutes int default 30)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_count int := 0;
begin
  if p_minutes is null or p_minutes < 1 then
    p_minutes := 30;
  end if;

  for v_id in
    select id
      from public.orders
     where status = 'pending'
       and created_at < now() - make_interval(mins => p_minutes)
     order by created_at
     for update skip locked
  loop
    perform public.release_order_stock(v_id, false);
    update public.orders set status = 'expired' where id = v_id and status = 'pending';
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Vuelve a reservar stock si un pago aprobado llega después de una expiración.
-- Devuelve false si ya no hay unidades suficientes.
create or replace function public.reserve_order_stock(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_row   record;
  v_stock int;
  v_avail text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then return false; end if;
  if v_order.stock_released_at is null then return true; end if;

  for v_row in
    select product_id, sum(qty)::int as qty
      from public.order_items
     where order_id = p_order_id and product_id is not null
     group by product_id
     order by product_id
  loop
    select stock, availability into v_stock, v_avail
      from public.products where id = v_row.product_id for update;
    if not found then return false; end if;
    if v_avail = 'agotado' or (v_stock is not null and v_stock < v_row.qty) then
      return false;
    end if;
  end loop;

  for v_row in
    select product_id, sum(qty)::int as qty
      from public.order_items
     where order_id = p_order_id and product_id is not null
     group by product_id
     order by product_id
  loop
    update public.products
       set stock = greatest(0, stock - v_row.qty)
     where id = v_row.product_id and stock is not null;
  end loop;

  update public.orders set stock_released_at = null where id = p_order_id;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. create_order Â· crea el pedido con precios y total calculados en servidor
-- ---------------------------------------------------------------------------
--  Recibe SOLO intenciÃ³n del cliente (sin precios):
--  {
--    "idempotencyKey": "...",
--    "userId": "<uuid verificado por la Edge Function o null>",
--    "items":  [{"productId":"<uuid>","qty":1,"selections":{"Talla":"M"}}],
--    "giftIds": ["gift-1"],
--    "customer": {"name","email","phone","city","address","notes"}
--  }
--  Devuelve {ok:true, order:{id,total,subtotal,count,items:[...]}}
--       o  {ok:false, error:"unavailable"|"min_order"|...}
create or replace function public.create_order(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_idem      text := nullif(trim(coalesce(p_payload->>'idempotencyKey','')), '');
  v_user      uuid := case
                         when coalesce(p_payload->>'userId','') ~
                           '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                         then (p_payload->>'userId')::uuid
                         else null
                       end;
  v_items     jsonb := case when jsonb_typeof(p_payload->'items') = 'array'
                             then p_payload->'items' else '[]'::jsonb end;
  v_gift_ids  jsonb := case when jsonb_typeof(p_payload->'giftIds') = 'array'
                             then p_payload->'giftIds' else '[]'::jsonb end;
  v_customer  jsonb := case when jsonb_typeof(p_payload->'customer') = 'object'
                             then p_payload->'customer' else '{}'::jsonb end;
  v_existing  public.orders;
  v_order     public.orders;
  v_row       record;
  v_item      jsonb;
  v_pid       uuid;
  v_qty       int;
  v_price     numeric(12,2);
  v_stock     int;
  v_availability text;
  v_pname     text;
  v_subtotal  numeric(12,2) := 0;
  v_count     int := 0;
  v_total     numeric(12,2) := 0;
  v_min       numeric(12,2) := 0;
  v_unavailable jsonb := '[]'::jsonb;
  v_gift      text;
  v_gift_name text;
  v_name      text := left(btrim(coalesce(v_customer->>'name','')), 160);
  v_email     text := lower(left(btrim(coalesce(v_customer->>'email','')), 200));
begin
  -- Libera reservas viejas antes de validar stock nuevo.
  perform public.expire_pending_orders(30);

  -- Idempotencia: si ya existe el pedido para esta clave, se devuelve tal cual.
  if v_idem is not null then
    select * into v_existing from public.orders where idempotency_key = v_idem limit 1;
    if found then
      return public.order_result(v_existing.id, true);
    end if;
  end if;

  if jsonb_array_length(v_items) = 0 then
    return jsonb_build_object('ok', false, 'error', 'empty_cart');
  end if;
  if jsonb_array_length(v_items) > 40 then
    return jsonb_build_object('ok', false, 'error', 'too_many_items');
  end if;
  if v_name = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_customer');
  end if;

  -- Validar cada lÃ­nea (tipo, cantidad, id) antes de tocar la base.
  for v_item in select value from jsonb_array_elements(v_items) loop
    if jsonb_typeof(v_item) <> 'object'
       or coalesce(v_item->>'productId','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      return jsonb_build_object('ok', false, 'error', 'invalid_item');
    end if;
    if coalesce(v_item->>'qty','') !~ '^[0-9]+$' then
      return jsonb_build_object('ok', false, 'error', 'invalid_qty');
    end if;
    if (v_item->>'qty')::int < 1 or (v_item->>'qty')::int > 50 then
      return jsonb_build_object('ok', false, 'error', 'invalid_qty');
    end if;
  end loop;

  -- Cantidad total por producto (evita sobreventa con lÃ­neas duplicadas).
  -- Se bloquean las filas en orden determinista para evitar deadlocks.
  for v_row in
    select (value->>'productId')::uuid as pid, sum((value->>'qty')::int)::int as qty
    from jsonb_array_elements(v_items)
    group by (value->>'productId')::uuid
    order by (value->>'productId')::uuid
  loop
    if v_row.qty < 1 or v_row.qty > 50 then
      return jsonb_build_object('ok', false, 'error', 'invalid_qty');
    end if;

    select name, price, stock, availability into v_pname, v_price, v_stock, v_availability
      from public.products where id = v_row.pid for update;

    if not found then
      return jsonb_build_object('ok', false, 'error', 'unknown_product');
    end if;
    if v_price is null then
      return jsonb_build_object('ok', false, 'error', 'unpriced_product', 'productName', v_pname);
    end if;
    if v_price < 0 then
      return jsonb_build_object('ok', false, 'error', 'invalid_price', 'productName', v_pname);
    end if;

    -- El bloqueo FOR UPDATE serializa compras simultÃ¡neas del mismo producto.
    -- Un producto marcado como agotado no se vende aunque tenga stock cargado.
    if v_availability = 'agotado' or (v_stock is not null and v_stock < v_row.qty) then
      v_unavailable := v_unavailable || jsonb_build_object(
        'productId', v_row.pid,
        'name', v_pname,
        'requested', v_row.qty,
        'available', case when v_availability = 'agotado' then 0 else v_stock end
      );
    else
      v_subtotal := v_subtotal + (v_price * v_row.qty);
      v_count := v_count + v_row.qty;
    end if;
  end loop;

  if jsonb_array_length(v_unavailable) > 0 then
    return jsonb_build_object('ok', false, 'error', 'unavailable', 'unavailable', v_unavailable);
  end if;

  select coalesce(min_order, 0) into v_min from public.site_settings limit 1;
  if v_min > 0 and v_subtotal < v_min then
    return jsonb_build_object('ok', false, 'error', 'min_order', 'minOrder', v_min, 'subtotal', v_subtotal);
  end if;

  -- El envÃ­o se coordina aparte: el total a cobrar es el subtotal del servidor.
  v_total := v_subtotal;

  begin
    insert into public.orders (
      user_id, customer_name, customer_email, customer_phone, customer_city,
      customer_document, customer_address, notes, subtotal, total, count, currency, status, idempotency_key
    ) values (
      v_user, v_name, v_email,
      left(btrim(coalesce(v_customer->>'phone','')), 40),
      left(btrim(coalesce(v_customer->>'city','')), 120),
      left(btrim(coalesce(v_customer->>'document','')), 40),
      left(btrim(coalesce(v_customer->>'address','')), 240),
      left(btrim(coalesce(v_customer->>'notes','')), 1000),
      v_subtotal, v_total, v_count, 'COP', 'pending', v_idem
    )
    returning * into v_order;
  exception when unique_violation then
    select * into v_existing from public.orders where idempotency_key = v_idem limit 1;
    if found then
      return public.order_result(v_existing.id, true);
    end if;
    raise;
  end;

  -- Ãtems con el precio del servidor (snapshot histÃ³rico).
  for v_item in select value from jsonb_array_elements(v_items) loop
    v_pid := (v_item->>'productId')::uuid;
    v_qty := (v_item->>'qty')::int;
    select name, price into v_pname, v_price from public.products where id = v_pid;

    insert into public.order_items (order_id, product_id, name, qty, price, selections)
    values (
      v_order.id, v_pid, v_pname, v_qty, v_price,
      case when jsonb_typeof(v_item->'selections') = 'object'
           then (select coalesce(jsonb_object_agg(k, left(v, 80)), '{}'::jsonb)
                   from jsonb_each_text(v_item->'selections') as t(k, v))
           else '{}'::jsonb end
    );
  end loop;

  -- Reservar inventario una sola vez por producto.
  -- `sold` se incrementa Ãºnicamente cuando el pago es aprobado.
  for v_row in
    select (value->>'productId')::uuid as pid, sum((value->>'qty')::int)::int as qty
    from jsonb_array_elements(v_items)
    group by (value->>'productId')::uuid
  loop
    update public.products
       set stock = greatest(0, stock - v_row.qty)
     where id = v_row.pid and stock is not null;
  end loop;

  -- Regalos: solo los que existen y estÃ¡n activos.
  for v_gift in select value from jsonb_array_elements_text(v_gift_ids) loop
    select name into v_gift_name from public.gifts where id = v_gift and enabled = true;
    if found then
      insert into public.order_gifts (order_id, gift_id, name)
      values (v_order.id, v_gift, v_gift_name);
    end if;
  end loop;

  return public.order_result(v_order.id, false);
end;
$$;

-- Devuelve el pedido con sus Ã­tems (para construir la preferencia de pago).
create or replace function public.order_result(p_order_id uuid, p_replayed boolean)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'ok', true,
    'replayed', p_replayed,
    'order', jsonb_build_object(
      'id', o.id,
      'total', o.total,
      'subtotal', o.subtotal,
      'count', o.count,
      'status', o.status,
      'currency', o.currency,
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'productId', oi.product_id,
          'name', oi.name,
          'qty', oi.qty,
          'price', oi.price,
          'selections', oi.selections
        ) order by oi.name)
        from public.order_items oi where oi.order_id = o.id
      ), '[]'::jsonb),
      'gifts', coalesce((
        select jsonb_agg(jsonb_build_object('id', og.gift_id, 'name', og.name))
        from public.order_gifts og where og.order_id = o.id
      ), '[]'::jsonb)
    )
  )
  from public.orders o where o.id = p_order_id;
$$;

-- Resumen seguro para la pantalla de confirmación (no expone dirección ni contacto).
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
    'customer_name', o.customer_name,
    'customer_city', o.customer_city,
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


-- ---------------------------------------------------------------------------
-- 3. mark_order_payment Â· Ãºnica fuente de verdad del pago (webhook)
-- ---------------------------------------------------------------------------
create or replace function public.mark_order_payment(
  p_reference   text,
  p_provider    text,
  p_payment_id  text,
  p_amount      numeric,
  p_currency    text,
  p_status      text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_row   record;
begin
  if coalesce(p_reference,'') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_reference');
  end if;

  select * into v_order from public.orders where id::text = p_reference for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if upper(coalesce(p_currency,'')) <> upper(v_order.currency) then
    return jsonb_build_object('ok', false, 'error', 'currency_mismatch',
                              'expected', v_order.currency, 'received', p_currency);
  end if;

  if v_order.status = 'paid' and p_status = 'approved' then
    return jsonb_build_object('ok', true, 'status', 'paid', 'already', true);
  end if;

  if p_status = 'approved' then
    if v_order.status not in ('pending','expired') then
      return jsonb_build_object('ok', false, 'error', 'order_not_pending', 'status', v_order.status);
    end if;
    if round(coalesce(p_amount, -1), 2) <> round(v_order.total, 2) then
      return jsonb_build_object('ok', false, 'error', 'amount_mismatch',
                                'expected', v_order.total, 'received', p_amount);
    end if;

    -- Si la reserva había expirado, intenta reservar de nuevo antes de cobrar.
    if v_order.stock_released_at is not null then
      if not public.reserve_order_stock(v_order.id) then
        return jsonb_build_object('ok', false, 'error', 'out_of_stock', 'status', v_order.status);
      end if;
    end if;

    -- El stock ya estaba reservado; ahora sí se contabiliza como vendido.
    for v_row in
      select product_id, sum(qty)::int as qty
        from public.order_items
       where order_id = v_order.id and product_id is not null
       group by product_id
    loop
      update public.products set sold = sold + v_row.qty where id = v_row.product_id;
    end loop;

    update public.orders
       set status = 'paid', provider = p_provider,
           provider_payment_id = p_payment_id, paid_at = now()
     where id = v_order.id;
    return jsonb_build_object('ok', true, 'status', 'paid');

  elsif p_status in ('pending','in_process','authorized') then
    if v_order.status <> 'pending' then
      return jsonb_build_object('ok', true, 'status', v_order.status);
    end if;
    update public.orders
       set status = 'pending', provider = p_provider, provider_payment_id = p_payment_id
     where id = v_order.id and status = 'pending';
    return jsonb_build_object('ok', true, 'status', 'pending');

  elsif p_status in ('rejected','cancelled') then
    if v_order.status <> 'pending' then
      return jsonb_build_object('ok', true, 'status', v_order.status);
    end if;
    perform public.release_order_stock(v_order.id, false);
    update public.orders
       set status = 'failed', provider = p_provider, provider_payment_id = p_payment_id
     where id = v_order.id and status = 'pending';
    return jsonb_build_object('ok', true, 'status', 'failed');

  elsif p_status in ('refunded','charged_back') then
    if v_order.status not in ('paid','pending') then
      return jsonb_build_object('ok', true, 'status', v_order.status);
    end if;
    if v_order.status = 'paid' then
      perform public.release_order_stock(v_order.id, true);
    else
      perform public.release_order_stock(v_order.id, false);
    end if;
    update public.orders
       set status = 'refunded', provider = p_provider, provider_payment_id = p_payment_id
     where id = v_order.id and status in ('paid','pending');
    return jsonb_build_object('ok', true, 'status', 'refunded');
  end if;

  return jsonb_build_object('ok', true, 'status', v_order.status);
end;
$$;
-- ---------------------------------------------------------------------------
-- 4. cancel_order Â· libera stock si la pasarela no pudo iniciar el cobro
-- ---------------------------------------------------------------------------
create or replace function public.cancel_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_order.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'not_pending', 'status', v_order.status);
  end if;

  perform public.release_order_stock(v_order.id, false);
  update public.orders set status = 'cancelled' where id = v_order.id;
  return jsonb_build_object('ok', true, 'status', 'cancelled');
end;
$$;

-- ---------------------------------------------------------------------------
-- 4b. Al eliminar un pedido, devolver stock y ajustar unidades vendidas
-- ---------------------------------------------------------------------------
create or replace function public.orders_release_stock_on_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  if old.stock_released_at is not null then
    return old;
  end if;

  for v_row in
    select product_id, sum(qty)::int as qty
      from public.order_items
     where order_id = old.id and product_id is not null
     group by product_id
  loop
    update public.products
       set stock = case when stock is not null then stock + v_row.qty else stock end,
           sold  = case when old.status = 'paid' then greatest(0, sold - v_row.qty) else sold end
     where id = v_row.product_id;
  end loop;

  return old;
end;
$$;

drop trigger if exists orders_release_stock_delete on public.orders;
create trigger orders_release_stock_delete
  before delete on public.orders
  for each row execute function public.orders_release_stock_on_delete();

-- ---------------------------------------------------------------------------
-- 5. Permisos · solo service_role (Edge Functions) puede crear/confirmar pagos
-- ---------------------------------------------------------------------------
revoke all on function public.create_order(jsonb)           from public, anon, authenticated;
revoke all on function public.order_result(uuid, boolean)   from public, anon, authenticated;
revoke all on function public.mark_order_payment(text,text,text,numeric,text,text) from public, anon, authenticated;
revoke all on function public.cancel_order(uuid)            from public, anon, authenticated;
revoke all on function public.release_order_stock(uuid, boolean) from public, anon, authenticated;
revoke all on function public.expire_pending_orders(int)    from public, anon, authenticated;
revoke all on function public.reserve_order_stock(uuid)     from public, anon, authenticated;
revoke all on function public.get_order_confirmation(uuid)  from public, anon, authenticated;

grant execute on function public.create_order(jsonb)        to service_role;
grant execute on function public.order_result(uuid, boolean) to service_role;
grant execute on function public.mark_order_payment(text,text,text,numeric,text,text) to service_role;
grant execute on function public.cancel_order(uuid)         to service_role;
grant execute on function public.release_order_stock(uuid, boolean) to service_role;
grant execute on function public.expire_pending_orders(int) to service_role;
grant execute on function public.reserve_order_stock(uuid)  to service_role;
grant execute on function public.get_order_confirmation(uuid) to anon, authenticated;

-- Cerrar la escritura pÃºblica de pedidos (antes cualquiera podÃ­a insertar).
drop policy if exists orders_anyone_insert      on public.orders;
drop policy if exists order_items_anyone_insert on public.order_items;
drop policy if exists order_gifts_anyone_insert on public.order_gifts;

revoke insert on public.orders      from anon, authenticated;
revoke insert on public.order_items from anon, authenticated;
revoke insert on public.order_gifts from anon, authenticated;

-- El descuento de inventario del cliente queda deshabilitado:
revoke execute on function public.commit_sale(jsonb) from anon, authenticated;

-- Realtime para pedidos (si la publicaciÃ³n existe).
do $$
begin
  begin
    alter publication supabase_realtime add table public.orders;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

