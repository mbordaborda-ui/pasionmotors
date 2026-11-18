-- ===========================================================================
-- PASION MOTORS · Actualización sobre una base ya creada
-- ---------------------------------------------------------------------------
-- Ejecuta TODO este archivo si ya corriste supabase/schema.sql antes.
-- Es seguro volver a ejecutarlo (idempotente). No borra datos.
--
-- NOTA: para seguimiento de pedidos, boletín, mensajes de contacto y los
-- nuevos productos pequeños ejecuta también supabase/nuevas-funciones.sql.
-- Para las solicitudes de productos agotados ejecuta además
-- supabase/solicitudes-productos.sql.
-- Para las compras seguras y estadísticas reales ejecuta supabase/pagos.sql
-- y después supabase/compras-seguras.sql.
-- ===========================================================================

-- 1) Permitir que un administrador edite perfiles de otros usuarios (rol, nombre)
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 2) Realtime · sincronización en vivo de las tablas principales
do $$
declare t text;
begin
  foreach t in array array[
    'products','product_images','product_variants','product_variant_options',
    'product_specs','site_settings','gifts','promos','spots','orders'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;   -- ya estaba publicada
      when undefined_object then null;   -- la publicación no existe (proyecto sin realtime)
    end;
  end loop;
end $$;
