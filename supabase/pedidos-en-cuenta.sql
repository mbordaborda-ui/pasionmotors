-- ===========================================================================
-- PASION MOTORS · PEDIDOS EN LA CUENTA DEL CLIENTE
-- ---------------------------------------------------------------------------
-- Ejecuta este archivo en Supabase → SQL Editor (idempotente).
-- Permite que un cliente vea sus pedidos en /cuenta cuando:
--   · el pedido está asociado a su usuario, o
--   · el correo del pedido coincide con el correo autenticado.
-- Así también aparecen compras hechas como invitado antes de crear la cuenta.
-- ===========================================================================

drop policy if exists orders_read_own_or_admin on public.orders;
create policy orders_read_own_or_admin on public.orders
  for select using (
    user_id = auth.uid()
    or lower(customer_email) = lower(auth.jwt() ->> 'email')
    or public.is_admin()
  );

drop policy if exists order_items_read on public.order_items;
create policy order_items_read on public.order_items
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
       where o.id = order_items.order_id
         and (
           o.user_id = auth.uid()
           or lower(o.customer_email) = lower(auth.jwt() ->> 'email')
         )
    )
  );

drop policy if exists order_gifts_read on public.order_gifts;
create policy order_gifts_read on public.order_gifts
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
       where o.id = order_gifts.order_id
         and (
           o.user_id = auth.uid()
           or lower(o.customer_email) = lower(auth.jwt() ->> 'email')
         )
    )
  );

select 'pedidos en cuenta actualizado' as resultado;
