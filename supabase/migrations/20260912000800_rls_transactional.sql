-- 20260912000800_rls_transactional.sql
-- RLS per BUILD_PROMPT §5 matrix for transactional tables.

-- coupons: none / none (validated server-side) / admin ALL
alter table public.coupons enable row level security;
drop policy if exists "coupons: admin all" on public.coupons;
create policy "coupons: admin all" on public.coupons
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.coupon_redemptions enable row level security;
drop policy if exists "coupon_redemptions: admin all" on public.coupon_redemptions;
create policy "coupon_redemptions: admin all" on public.coupon_redemptions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- shipping zones/rates: public SELECT where active (PDP delivery estimate); admin ALL
alter table public.shipping_zones enable row level security;
drop policy if exists "shipping_zones: public read active" on public.shipping_zones;
create policy "shipping_zones: public read active" on public.shipping_zones
  for select to anon, authenticated using (is_active = true);
drop policy if exists "shipping_zones: admin all" on public.shipping_zones;
create policy "shipping_zones: admin all" on public.shipping_zones
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.shipping_rates enable row level security;
drop policy if exists "shipping_rates: public read" on public.shipping_rates;
create policy "shipping_rates: public read" on public.shipping_rates
  for select to anon, authenticated
  using (exists (select 1 from public.shipping_zones z where z.id = zone_id and z.is_active = true));
drop policy if exists "shipping_rates: admin all" on public.shipping_rates;
create policy "shipping_rates: admin all" on public.shipping_rates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- carts / cart_items: none for anon or customer (server-only via service role); admin SELECT
alter table public.carts enable row level security;
drop policy if exists "carts: admin select" on public.carts;
create policy "carts: admin select" on public.carts
  for select to authenticated using (public.is_admin());

alter table public.cart_items enable row level security;
drop policy if exists "cart_items: admin select" on public.cart_items;
create policy "cart_items: admin select" on public.cart_items
  for select to authenticated using (public.is_admin());

-- orders: customer SELECT own; admin ALL
alter table public.orders enable row level security;
drop policy if exists "orders: self select" on public.orders;
create policy "orders: self select" on public.orders
  for select to authenticated using (customer_id = auth.uid());
drop policy if exists "orders: admin all" on public.orders;
create policy "orders: admin all" on public.orders
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- order_items: customer SELECT via parent order; admin ALL
alter table public.order_items enable row level security;
drop policy if exists "order_items: self select" on public.order_items;
create policy "order_items: self select" on public.order_items
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));
drop policy if exists "order_items: admin all" on public.order_items;
create policy "order_items: admin all" on public.order_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- order_events: customer SELECT via parent order; admin ALL
alter table public.order_events enable row level security;
drop policy if exists "order_events: self select" on public.order_events;
create policy "order_events: self select" on public.order_events
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));
drop policy if exists "order_events: admin all" on public.order_events;
create policy "order_events: admin all" on public.order_events
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- payment_transactions: none / none / admin SELECT
alter table public.payment_transactions enable row level security;
drop policy if exists "payment_transactions: admin select" on public.payment_transactions;
create policy "payment_transactions: admin select" on public.payment_transactions
  for select to authenticated using (public.is_admin());

-- reviews: public SELECT approved; customer INSERT own; admin ALL
alter table public.reviews enable row level security;
drop policy if exists "reviews: public read approved" on public.reviews;
create policy "reviews: public read approved" on public.reviews
  for select to anon, authenticated using (status = 'approved');
drop policy if exists "reviews: self insert" on public.reviews;
create policy "reviews: self insert" on public.reviews
  for insert to authenticated with check (customer_id = auth.uid() and status = 'pending');
drop policy if exists "reviews: admin all" on public.reviews;
create policy "reviews: admin all" on public.reviews
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- stock_movements: admin ALL only
alter table public.stock_movements enable row level security;
drop policy if exists "stock_movements: admin all" on public.stock_movements;
create policy "stock_movements: admin all" on public.stock_movements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- couriers: admin ALL only (dispatch is server-side)
alter table public.couriers enable row level security;
drop policy if exists "couriers: admin all" on public.couriers;
create policy "couriers: admin all" on public.couriers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- shipments: customer SELECT via parent order (tracking); admin ALL
alter table public.shipments enable row level security;
drop policy if exists "shipments: self select" on public.shipments;
create policy "shipments: self select" on public.shipments
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));
drop policy if exists "shipments: admin all" on public.shipments;
create policy "shipments: admin all" on public.shipments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- courier_api_log / courier_score_cache: admin SELECT only (writes via service role)
alter table public.courier_api_log enable row level security;
drop policy if exists "courier_api_log: admin select" on public.courier_api_log;
create policy "courier_api_log: admin select" on public.courier_api_log
  for select to authenticated using (public.is_admin());

alter table public.courier_score_cache enable row level security;
drop policy if exists "courier_score_cache: admin select" on public.courier_score_cache;
create policy "courier_score_cache: admin select" on public.courier_score_cache
  for select to authenticated using (public.is_admin());
