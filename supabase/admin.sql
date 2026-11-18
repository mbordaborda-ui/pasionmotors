-- ===========================================================================
-- PASION MOTORS · CONTROLES DEL PANEL ADMINISTRADOR
-- ---------------------------------------------------------------------------
-- Ejecuta TODO este archivo en Supabase → SQL Editor (idempotente).
-- Añade:
--   · Productos marcados manualmente como «Más vendidos» y su orden.
--   · Galería «El garage» editable desde el panel.
-- ===========================================================================

alter table public.products
  add column if not exists best_seller boolean not null default false;
alter table public.products
  add column if not exists best_seller_order int not null default 0;

create index if not exists products_best_seller_idx
  on public.products (best_seller, best_seller_order);

alter table public.site_settings
  add column if not exists garage jsonb not null default '[]'::jsonb;

-- Realtime para que los cambios del panel se vean al instante.
do $$
declare t text;
begin
  foreach t in array array['products','categories','site_settings'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
      when undefined_object then null;
    end;
  end loop;
end $$;

-- Comprobación rápida.
select
  count(*) filter (where best_seller) as productos_mas_vendidos,
  count(*) as productos_totales
from public.products;
