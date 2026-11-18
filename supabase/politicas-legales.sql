-- ===========================================================================
-- PASION MOTORS · POLÍTICAS LEGALES
-- ---------------------------------------------------------------------------
-- Ejecuta TODO este archivo en Supabase → SQL Editor (idempotente).
-- Agrega la fecha de última actualización de las políticas para mostrarla en
-- la página /politicas y poder editarla desde Admin → Ajustes.
-- ===========================================================================

alter table public.site_settings
  add column if not exists legal_updated_at date default '2026-10-27';

update public.site_settings
   set legal_updated_at = '2026-10-27'
 where id = 1 and legal_updated_at is null;

select legal_updated_at as ultima_actualizacion from public.site_settings where id = 1;
