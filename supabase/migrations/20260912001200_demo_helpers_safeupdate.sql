-- 20260912001200_demo_helpers_safeupdate.sql
-- Supabase runs pg-safeupdate for API connections: every UPDATE needs a WHERE.
-- Re-create the two helpers with explicit `where true` clauses.

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
  update public.customers
     set total_orders = 0, total_delivered = 0, total_cancelled = 0, total_returned = 0
   where true;
end;
$$;

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
    cancelled_at = cancelled_at + d
  where true;
  get diagnostics n = row_count;
  update public.order_events set created_at = created_at + d where true;
  update public.order_items set created_at = created_at + d where true;
  update public.payment_transactions set created_at = created_at + d, validated_at = validated_at + d where true;
  update public.shipments set created_at = created_at + d, dispatched_at = dispatched_at + d, delivered_at = delivered_at + d where true;
  update public.reviews set created_at = created_at + d, replied_at = replied_at + d where true;
  update public.customers set created_at = created_at + d where true;
  update public.demo_sms_log set sent_at = sent_at + d, created_at = created_at + d where true;
  return n;
end;
$$;

revoke execute on function public.demo_truncate_transactional() from public, anon, authenticated;
revoke execute on function public.demo_shift_clock(int) from public, anon, authenticated;
