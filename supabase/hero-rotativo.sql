-- ===========================================================================
-- PASION MOTORS · ROTACIÓN DE LA FOTO PRINCIPAL (HERO)
-- ---------------------------------------------------------------------------
-- Ejecuta TODO este archivo en Supabase → SQL Editor.
-- Es idempotente: puedes volver a ejecutarlo sin perder datos.
--
-- Añade:
--   · hero_images   → lista de URLs de las fotos que rotan.
--   · hero_rotation → 'off' | 'random' | 'daily' | 'weekly'.
--
-- Las fotos se suben a Storage (bucket product-images, carpeta hero/).
-- En la base solo se guardan las URLs.
-- ===========================================================================

alter table public.site_settings
  add column if not exists hero_images text[] not null default '{}';

alter table public.site_settings
  add column if not exists hero_rotation text not null default 'off';

-- Solo se aceptan los cuatro modos conocidos. Se elimina la restricción
-- anterior (si existe) para poder añadir 'random' sin fallar al guardar.
alter table public.site_settings
  drop constraint if exists site_settings_hero_rotation_check;

alter table public.site_settings
  add constraint site_settings_hero_rotation_check
  check (hero_rotation in ('off', 'random', 'daily', 'weekly'));

-- Verificación rápida: cuántas fotos hay configuradas.
select id,
       hero_rotation,
       coalesce(array_length(hero_images, 1), 0) as fotos
  from public.site_settings
 where id = 1;
