-- ===========================================================================
-- PASION MOTORS · COMPRAS SEGURAS Y ESTADÍSTICAS REALES
-- ---------------------------------------------------------------------------
-- Ejecuta este archivo DESPUÉS de supabase/pagos.sql.
-- Es idempotente.
--
--   1) Recalcula `sold` usando únicamente pedidos pagados.
--   2) Expira reservas pendientes viejas y devuelve el stock.
--   3) Programa la limpieza automática cada 10 minutos con pg_cron.
-- ===========================================================================

-- `sold` = unidades realmente pagadas (no reservas pendientes).
update public.products p
   set sold = coalesce((
     select sum(oi.qty)::int
       from public.order_items oi
       join public.orders o on o.id = oi.order_id
      where oi.product_id = p.id and o.status = 'paid'
   ), 0);

-- Libera reservas antiguas ahora mismo.
select public.expire_pending_orders(30) as pedidos_expirados;

-- Limpieza automática cada 10 minutos.
create extension if not exists pg_cron;

do $$
begin
  begin
    perform cron.unschedule('pm-expire-pending-orders');
  exception
    when others then null;
  end;

  begin
    perform cron.schedule(
      'pm-expire-pending-orders',
      '*/10 * * * *',
      $cron$select public.expire_pending_orders(30);$cron$
    );
  exception
    when others then null;
  end;
end $$;

select
  (select count(*) from public.orders where status = 'pending') as pedidos_pendientes,
  (select count(*) from public.orders where status = 'paid') as pedidos_pagados,
  (select coalesce(sum(sold), 0) from public.products) as unidades_vendidas;
