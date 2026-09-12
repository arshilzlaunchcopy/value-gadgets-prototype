-- 20260912010200_stock_reservations.sql
-- 30-minute stock holds at checkout (BUILD_PROMPT_PART2 §15.6).
-- available = stock_qty - sum(active reservations by OTHER carts).

create table if not exists public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity int not null check (quantity > 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);
select public.apply_updated_at('public.stock_reservations');
create index if not exists stock_reservations_variant_idx on public.stock_reservations (variant_id, expires_at);
create index if not exists stock_reservations_expires_idx on public.stock_reservations (expires_at);

alter table public.stock_reservations enable row level security;
drop policy if exists "stock_reservations: admin select" on public.stock_reservations;
create policy "stock_reservations: admin select" on public.stock_reservations
  for select to authenticated using (public.is_admin());
-- writes only via service role (reserve_stock / release_* below)

-- Active reserved quantity for a variant, optionally excluding one cart.
create or replace function public.reserved_qty(p_variant uuid, p_exclude_cart uuid default null)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(quantity), 0)::int
  from public.stock_reservations
  where variant_id = p_variant
    and expires_at > now()
    and (p_exclude_cart is null or cart_id <> p_exclude_cart);
$$;
-- read-only; the public views use it
grant execute on function public.reserved_qty(uuid, uuid) to anon, authenticated;

-- Atomically (re)reserve p_qty for a cart. Returns the remaining available
-- quantity after the reservation, or -1 when there is not enough stock.
-- p_qty <= 0 releases the cart's hold on that variant.
create or replace function public.reserve_stock(p_cart uuid, p_variant uuid, p_qty int, p_minutes int default 30)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock int;
  v_reserved int;
  v_available int;
begin
  select stock_qty into v_stock from public.product_variants where id = p_variant for update;
  if not found then
    return -1;
  end if;
  select coalesce(sum(quantity), 0) into v_reserved
    from public.stock_reservations
   where variant_id = p_variant and expires_at > now() and cart_id <> p_cart;
  v_available := v_stock - v_reserved;
  if p_qty <= 0 then
    delete from public.stock_reservations where cart_id = p_cart and variant_id = p_variant;
    return v_available;
  end if;
  if v_available < p_qty then
    return -1;
  end if;
  insert into public.stock_reservations (cart_id, variant_id, quantity, expires_at)
  values (p_cart, p_variant, p_qty, now() + make_interval(mins => p_minutes))
  on conflict (cart_id, variant_id) do update
    set quantity = excluded.quantity, expires_at = excluded.expires_at;
  return v_available - p_qty;
end;
$$;

create or replace function public.release_cart_reservations(p_cart uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  delete from public.stock_reservations where cart_id = p_cart;
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.release_expired_reservations()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  delete from public.stock_reservations where expires_at <= now();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.reserve_stock(uuid, uuid, int, int) from public, anon, authenticated;
revoke execute on function public.release_cart_reservations(uuid) from public, anon, authenticated;
revoke execute on function public.release_expired_reservations() from public, anon, authenticated;
