-- ============================================================================
-- PASION MOTORS · FOTOS DEL CELULAR (Car Spotting y productos)
-- ----------------------------------------------------------------------------
-- Deja los buckets listos para fotos modernas de celular:
--   · hasta 15 MB por archivo (antes no había límite, o 5 MB con el refuerzo),
--   · JPG, PNG, WebP, AVIF, HEIC y HEIF,
--   · la tabla `spots` solo acepta URLs públicas y textos acotados.
--
-- Es idempotente: puedes ejecutarlo varias veces.
-- ============================================================================

update storage.buckets
   set file_size_limit = 15728640,
       allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif'
       ]
 where id in ('spots', 'product-images');

-- Subidas anónimas al Car Spotting (los visitantes pueden publicar).
-- El tamaño y el tipo real los controla el bucket; aquí solo validamos la ruta.
drop policy if exists storage_spots_insert on storage.objects;
create policy storage_spots_insert on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'spots'
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'avif', 'heic', 'heif')
  );

-- La foto debe ser una URL pública (nunca base64) y los textos tienen topes.
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

select id, file_size_limit, allowed_mime_types
  from storage.buckets
 where id in ('spots', 'product-images');
