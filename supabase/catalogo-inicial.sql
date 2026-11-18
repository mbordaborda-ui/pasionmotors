-- ===========================================================================
-- PASION MOTORS · CATÁLOGO INICIAL (23 productos)
-- ---------------------------------------------------------------------------
-- ⚠️  EJECUTAR UNA SOLA VEZ, cuando quieras dejar la tienda con el inventario
--     real de arranque.
--
-- Qué hace:
--   1) Crea o actualiza los 23 productos (nombre, categoría, precio, costo,
--      stock y orden). No toca `sold` (ventas acumuladas) ni las fotos.
--   2) Borra cualquier otro producto que exista en la base.
--
-- Los pedidos NO se pierden: `order_items` conserva nombre, cantidad y precio
-- de lo vendido; solo pierde el vínculo al producto eliminado.
--
-- Es idempotente, pero si más adelante agregas productos nuevos desde el panel
-- NO vuelvas a ejecutarlo: borraría esos productos nuevos.
-- ===========================================================================

-- 1) Los 23 productos con los que arranca la tienda.
insert into public.products
  (slug, name, category_id, price, cost, stock, availability, sort_order)
values
  ('aleron-frente-carro',             'Alerón frente de carro',             'accesorios',     29900,  8822, 1, 'disponible', 1),
  ('protectores-de-hombro-negro',     'Protectores de hombro negro',        'accesorios',     29900, 18310, 1, 'disponible', 2),
  ('porsche-burago-azul',             'Porsche Bburago azul',               'coleccionables', 24900, 19948, 1, 'disponible', 3),
  ('porsche-burago-negro',            'Porsche Bburago negro',              'coleccionables', 24900, 19948, 1, 'disponible', 4),
  ('llavero-rueda-negro-amarillo',    'Llavero rueda negro-amarillo',       'accesorios',     14900,  8721, 1, 'disponible', 5),
  ('camiseta-tokio',                  'Camiseta Tokio',                     'camisetas',      40900, 20714, 1, 'disponible', 6),
  ('protectores-de-hombro-rojo',      'Protectores de hombro rojo',         'accesorios',     29990, 13506, 1, 'disponible', 7),
  ('soporte-silla-rojo-celular',      'Soporte silla rojo celular',         'accesorios',     29990, 12872, 1, 'disponible', 8),
  ('luces-led-interior-carro',        'Luces LED interior carro',           'accesorios',     34900, 15408, 1, 'disponible', 9),
  ('sticker-frente-carro',            'Sticker frente carro',               'accesorios',     24900, 10435, 1, 'disponible', 10),
  ('volante-fibra-de-carbono',        'Volante fibra de carbono',           'accesorios',     59900, 29982, 1, 'disponible', 11),
  ('llavero-rueda-plateado',          'Llavero rueda plateado',             'accesorios',     14900,  8721, 1, 'disponible', 12),
  ('llavero-rueda-negro-rojo',        'Llavero rueda negro-rojo',           'accesorios',     14900,  6291, 1, 'disponible', 13),
  ('camiseta-porsche-blanca',         'Camiseta Porsche blanca',            'camisetas',      59900, 23093, 1, 'disponible', 14),
  ('camiseta-porsche-negra-morado',   'Camiseta Porsche negra morado',      'camisetas',      59900, 23093, 1, 'disponible', 15),
  ('camiseta-rays',                   'Camiseta Rays',                      'camisetas',      59900, 26350, 1, 'disponible', 16),
  ('camiseta-rays-azul',              'Camiseta Rays azul',                 'camisetas',      59900, 26350, 1, 'disponible', 17),
  ('llaveros-variados',               'Llaveros variados',                  'accesorios',      9900,  3536, 8, 'disponible', 18),
  ('llaveros-variados-promo',         'Llaveros variados promo',            'accesorios',      9990,  3059, 8, 'disponible', 19),
  ('camiseta-porsche-blanca-mujer',   'Camiseta Porsche blanca mujer',      'camisetas',      59900, 15982, 1, 'disponible', 20),
  ('camiseta-porsche-mujer-negra-rosa','Camiseta Porsche mujer negra rosa', 'camisetas',      59900, 22105, 1, 'disponible', 21),
  ('camiseta-porsche-hombre-negra',   'Camiseta Porsche hombre negra',      'camisetas',      59900, 29925, 1, 'disponible', 22),
  ('ford-mustang-burago',             'Ford Mustang Bburago',               'coleccionables', 24900, 19913, 1, 'disponible', 23)
on conflict (slug) do update set
  name         = excluded.name,
  category_id  = excluded.category_id,
  price        = excluded.price,
  cost         = excluded.cost,
  stock        = excluded.stock,
  availability = excluded.availability,
  sort_order   = excluded.sort_order;

-- 2) Fuera todo lo que no esté en la lista de arranque.
delete from public.products
 where slug not in (
   'aleron-frente-carro',
   'protectores-de-hombro-negro',
   'porsche-burago-azul',
   'porsche-burago-negro',
   'llavero-rueda-negro-amarillo',
   'camiseta-tokio',
   'protectores-de-hombro-rojo',
   'soporte-silla-rojo-celular',
   'luces-led-interior-carro',
   'sticker-frente-carro',
   'volante-fibra-de-carbono',
   'llavero-rueda-plateado',
   'llavero-rueda-negro-rojo',
   'camiseta-porsche-blanca',
   'camiseta-porsche-negra-morado',
   'camiseta-rays',
   'camiseta-rays-azul',
   'llaveros-variados',
   'llaveros-variados-promo',
   'camiseta-porsche-blanca-mujer',
   'camiseta-porsche-mujer-negra-rosa',
   'camiseta-porsche-hombre-negra',
   'ford-mustang-burago'
 );

-- 3) Comprobación: deben aparecer exactamente 23 productos.
select count(*) as total_productos from public.products;

select slug, name, category_id, price, cost, stock, sort_order
  from public.products
 order by sort_order;
