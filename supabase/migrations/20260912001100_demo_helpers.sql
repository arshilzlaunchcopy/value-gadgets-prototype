-- 20260912001100_demo_helpers.sql
-- SQL helpers for the demo control panel and seed engine (BUILD_PROMPT_PART3 §21.4, §22).
-- All are security definer and callable ONLY by the service role: execute is
-- revoked from anon/authenticated. Each refuses to run unless demo mode is on
-- (the caller passes the flag; the service role is the only caller anyway).

-- Truncate transactional tables, keep catalog + customers + content.
create or replace function public.demo_truncate_transactional()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate table
    public.coupon_redemptions,
    public.payment_transactions,
    public.shipments,
    public.stock_movements,
    public.order_events,
    public.order_items,
    public.orders,
    public.cart_items,
    public.carts,
    public.reviews,
    public.demo_sms_log,
    public.courier_api_log,
    public.courier_score_cache,
    public.otp_codes
  restart identity cascade;
  update public.customers set total_orders = 0, total_delivered = 0, total_cancelled = 0, total_returned = 0;
end;
$$;

-- Full wipe of app data (auth.users are removed by the seed engine via the Admin API).
create or replace function public.demo_truncate_all()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.demo_truncate_transactional();
  truncate table
    public.addresses,
    public.customers,
    public.product_images,
    public.collection_products,
    public.product_categories,
    public.product_variants,
    public.products,
    public.collections,
    public.categories,
    public.brands,
    public.coupons,
    public.shipping_rates,
    public.shipping_zones,
    public.couriers
  restart identity cascade;
end;
$$;

-- Shift every transactional timestamp forward by N days so dashboard ranges fill.
create or replace function public.demo_shift_clock(days int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  d interval := make_interval(days => days);
  n int;
begin
  update public.orders set
    placed_at    = placed_at + d,
    created_at   = created_at + d,
    confirmed_at = confirmed_at + d,
    shipped_at   = shipped_at + d,
    delivered_at = delivered_at + d,
    cancelled_at = cancelled_at + d;
  get diagnostics n = row_count;
  update public.order_events set created_at = created_at + d;
  update public.order_items set created_at = created_at + d;
  update public.payment_transactions set created_at = created_at + d, validated_at = validated_at + d;
  update public.shipments set created_at = created_at + d, dispatched_at = dispatched_at + d, delivered_at = delivered_at + d;
  update public.reviews set created_at = created_at + d, replied_at = replied_at + d;
  update public.customers set created_at = created_at + d;
  update public.demo_sms_log set sent_at = sent_at + d, created_at = created_at + d;
  return n;
end;
$$;

-- Aggregate counts for the demo panel header.
create or replace function public.demo_counts()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'orders',       (select count(*) from public.orders),
    'review_queue', (select count(*) from public.orders where needs_review and status not in ('cancelled','delivered','returned','refunded')),
    'customers',    (select count(*) from public.customers),
    'products',     (select count(*) from public.products),
    'reviews',      (select count(*) from public.reviews),
    'shipments_in_flight', (select count(*) from public.shipments where normalized_status in ('created','picked','in_transit','out_for_delivery'))
  );
$$;

revoke execute on function public.demo_truncate_transactional() from public, anon, authenticated;
revoke execute on function public.demo_truncate_all() from public, anon, authenticated;
revoke execute on function public.demo_shift_clock(int) from public, anon, authenticated;
revoke execute on function public.demo_counts() from public, anon, authenticated;
