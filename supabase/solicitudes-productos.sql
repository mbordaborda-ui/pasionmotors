-- ===========================================================================
-- PASION MOTORS · SOLICITUDES DE PRODUCTOS AGOTADOS
-- ---------------------------------------------------------------------------
-- Ejecuta TODO este archivo en Supabase → SQL Editor (idempotente).
-- Permite que un cliente solicite un producto agotado y que el admin vea,
-- agrupada por producto, la demanda real para decidir qué reabastecer.
-- ===========================================================================

create table if not exists public.restock_requests (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid references public.products(id) on delete set null,
  product_name     text not null,
  product_slug     text,
  product_category text,
  email            text not null,
  name             text,
  phone            text,
  qty              int not null default 1 check (qty between 1 and 99),
  notes            text,
  status           text not null default 'new'
                   check (status in ('new','contacted','ordered','restocked','closed')),
  user_id          uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists restock_requests_created_idx
  on public.restock_requests (created_at desc);
create index if not exists restock_requests_product_idx
  on public.restock_requests (product_id);
create unique index if not exists restock_requests_product_email_key
  on public.restock_requests (product_id, email);

drop trigger if exists restock_requests_updated_at on public.restock_requests;
create trigger restock_requests_updated_at
  before update on public.restock_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Solicitud desde la web: valida, guarda y evita duplicados por cliente/producto
-- ---------------------------------------------------------------------------
create or replace function public.request_restock(
  p_product_id uuid,
  p_email      text,
  p_name       text default null,
  p_phone      text default null,
  p_qty        int default 1,
  p_notes      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email    text := lower(trim(coalesce(p_email, '')));
  v_name     text := nullif(left(btrim(coalesce(p_name, '')), 160), '');
  v_phone    text := nullif(left(btrim(coalesce(p_phone, '')), 40), '');
  v_notes    text := nullif(left(btrim(coalesce(p_notes, '')), 500), '');
  v_qty      int  := greatest(1, least(coalesce(p_qty, 1), 99));
  v_product  public.products;
  v_existing uuid;
begin
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(v_email) > 200 then
    return jsonb_build_object('ok', false, 'error', 'invalid_email');
  end if;

  select * into v_product from public.products where id = p_product_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'unknown_product');
  end if;

  if v_product.availability <> 'agotado'
     and (v_product.stock is null or v_product.stock > 0) then
    return jsonb_build_object('ok', false, 'error', 'available');
  end if;

  select id into v_existing
    from public.restock_requests
   where product_id = v_product.id and email = v_email
   limit 1;

  if v_existing is not null then
    update public.restock_requests
       set name = coalesce(v_name, name),
           phone = coalesce(v_phone, phone),
           qty = v_qty,
           notes = coalesce(v_notes, notes),
           user_id = coalesce(auth.uid(), user_id),
           status = case when status in ('restocked','closed') then 'new' else status end,
           updated_at = now()
     where id = v_existing;
    return jsonb_build_object('ok', true, 'status', 'existing');
  end if;

  insert into public.restock_requests (
    product_id, product_name, product_slug, product_category,
    email, name, phone, qty, notes, user_id
  ) values (
    v_product.id, v_product.name, v_product.slug, v_product.category_id,
    v_email, v_name, v_phone, v_qty, v_notes, auth.uid()
  );

  return jsonb_build_object('ok', true, 'status', 'new');
end;
$$;

revoke all on function public.request_restock(uuid, text, text, text, int, text) from public;
grant execute on function public.request_restock(uuid, text, text, text, int, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seguridad: solo el admin puede leer, cambiar estado o eliminar
-- ---------------------------------------------------------------------------
alter table public.restock_requests enable row level security;

drop policy if exists restock_admin_read on public.restock_requests;
create policy restock_admin_read on public.restock_requests
  for select to authenticated using (public.is_admin());

drop policy if exists restock_admin_update on public.restock_requests;
create policy restock_admin_update on public.restock_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists restock_admin_delete on public.restock_requests;
create policy restock_admin_delete on public.restock_requests
  for delete to authenticated using (public.is_admin());

grant select, update, delete on public.restock_requests to authenticated;

-- Realtime para que el panel vea las solicitudes al instante.
do $$
begin
  begin
    alter publication supabase_realtime add table public.restock_requests;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

select count(*) as solicitudes from public.restock_requests;
