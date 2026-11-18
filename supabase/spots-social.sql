-- ============================================================================
-- PASION MOTORS · LIKES Y COMENTARIOS EN CAR SPOTTING
-- ----------------------------------------------------------------------------
-- Agrega «me gusta» y comentarios a las fotos de la comunidad.
--   · Cualquiera puede leer.
--   · Solo usuarios con sesión pueden dar like o comentar.
--   · Cada usuario puede borrar sus propios comentarios; el admin, todos.
--   · Máximo 20 comentarios por hora y 500 caracteres por comentario.
--
-- Es idempotente: puedes ejecutarlo varias veces.
-- ============================================================================

create table if not exists public.spot_likes (
  spot_id    uuid not null references public.spots(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (spot_id, user_id)
);

create table if not exists public.spot_comments (
  id         uuid primary key default gen_random_uuid(),
  spot_id    uuid not null references public.spots(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  author     text,
  body       text not null,
  created_at timestamptz not null default now(),
  constraint spot_comments_body_len check (char_length(btrim(body)) between 1 and 500),
  constraint spot_comments_author_len check (char_length(coalesce(author, '')) <= 80)
);

create index if not exists spot_likes_spot_idx on public.spot_likes(spot_id);
create index if not exists spot_comments_spot_idx on public.spot_comments(spot_id, created_at);
create index if not exists spot_comments_user_idx on public.spot_comments(user_id, created_at desc);

alter table public.spot_likes enable row level security;
alter table public.spot_comments enable row level security;

-- Likes -----------------------------------------------------------------------
drop policy if exists spot_likes_read on public.spot_likes;
create policy spot_likes_read on public.spot_likes
  for select using (true);

drop policy if exists spot_likes_insert on public.spot_likes;
create policy spot_likes_insert on public.spot_likes
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists spot_likes_delete on public.spot_likes;
create policy spot_likes_delete on public.spot_likes
  for delete to authenticated
  using (user_id = auth.uid());

-- Comentarios ----------------------------------------------------------------
drop policy if exists spot_comments_read on public.spot_comments;
create policy spot_comments_read on public.spot_comments
  for select using (true);

drop policy if exists spot_comments_insert on public.spot_comments;
create policy spot_comments_insert on public.spot_comments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and char_length(btrim(body)) between 1 and 500
    and char_length(coalesce(author, '')) <= 80
  );

drop policy if exists spot_comments_delete on public.spot_comments;
create policy spot_comments_delete on public.spot_comments
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

grant select on public.spot_likes, public.spot_comments to anon, authenticated;
grant insert, delete on public.spot_likes to authenticated;
grant insert, delete on public.spot_comments to authenticated;

-- Límite anti-spam: 20 comentarios por hora por usuario -------------------------
create or replace function public.limit_spot_comments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent integer;
begin
  select count(*) into recent
    from public.spot_comments
   where user_id = new.user_id
     and created_at > now() - interval '1 hour';

  if recent >= 20 then
    raise exception 'Has publicado demasiados comentarios. Espera un rato antes de volver a comentar.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists spot_comments_rate_limit on public.spot_comments;
create trigger spot_comments_rate_limit
  before insert on public.spot_comments
  for each row execute function public.limit_spot_comments();

-- Tiempo real (para que likes y comentarios aparezcan sin recargar) ------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'spots'
    ) then
      alter publication supabase_realtime add table public.spots;
    end if;

    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'spot_likes'
    ) then
      alter publication supabase_realtime add table public.spot_likes;
    end if;

    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'spot_comments'
    ) then
      alter publication supabase_realtime add table public.spot_comments;
    end if;
  end if;
end $$;

select
  (select count(*) from public.spot_likes) as likes,
  (select count(*) from public.spot_comments) as comentarios;
