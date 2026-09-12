-- 20260912020300_admin_stats.sql
-- Dashboard aggregates (BUILD_PROMPT §6.2) in one round trip.
-- Service-role only (execute revoked); the app verifies the admin session first.
-- p_days = 1 -> since local midnight (Asia/Dhaka); 7 / 30 -> rolling windows.

create or replace function public.admin_dashboard_stats(p_days int default 7)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_tz text := 'Asia/Dhaka';
  v_from timestamptz;
  v_prev_from timestamptz;
  v_now timestamptz := now();
  v_len interval;
  v_cur jsonb;
  v_prev jsonb;
  v_series jsonb;
  v_top jsonb;
  v_low jsonb;
  v_low_count int;
  v_review int;
  v_carts int;
begin
  if p_days <= 1 then
    v_from := (date_trunc('day', v_now at time zone v_tz)) at time zone v_tz;
  else
    v_from := v_now - make_interval(days => p_days);
  end if;
  v_len := v_now - v_from;
  v_prev_from := v_from - v_len;

  select jsonb_build_object(
    'revenue_bdt', coalesce(sum(total_bdt) filter (where status not in ('cancelled','refunded','returned')), 0),
    'orders', count(*),
    'cod_orders', count(*) filter (where payment_method = 'cod'),
    'online_orders', count(*) filter (where payment_method = 'sslcommerz'),
    'cod_revenue_bdt', coalesce(sum(total_bdt) filter (where payment_method = 'cod' and status not in ('cancelled','refunded','returned')), 0),
    'online_revenue_bdt', coalesce(sum(total_bdt) filter (where payment_method = 'sslcommerz' and status not in ('cancelled','refunded','returned')), 0),
    'cancelled', count(*) filter (where status = 'cancelled'),
    'returned', count(*) filter (where status = 'returned'),
    'delivered', count(*) filter (where status = 'delivered')
  ) into v_cur
  from public.orders where placed_at >= v_from and placed_at < v_now;

  select jsonb_build_object(
    'revenue_bdt', coalesce(sum(total_bdt) filter (where status not in ('cancelled','refunded','returned')), 0),
    'orders', count(*)
  ) into v_prev
  from public.orders where placed_at >= v_prev_from and placed_at < v_from;

  select coalesce(jsonb_agg(jsonb_build_object('date', d.day, 'revenue_bdt', coalesce(o.rev, 0), 'orders', coalesce(o.cnt, 0)) order by d.day), '[]'::jsonb)
    into v_series
  from generate_series((v_from at time zone v_tz)::date, (v_now at time zone v_tz)::date, interval '1 day') as d(day)
  left join (
    select (placed_at at time zone v_tz)::date as day,
           sum(total_bdt) filter (where status not in ('cancelled','refunded','returned')) as rev,
           count(*) as cnt
      from public.orders where placed_at >= v_from and placed_at < v_now
     group by 1
  ) o on o.day = d.day;

  select coalesce(jsonb_agg(t order by t.qty desc), '[]'::jsonb) into v_top
  from (
    select oi.product_id, oi.product_title, sum(oi.quantity)::int as qty, sum(oi.line_total_bdt)::int as revenue_bdt
      from public.order_items oi join public.orders o on o.id = oi.order_id
     where o.placed_at >= v_from and o.placed_at < v_now and o.status not in ('cancelled','refunded','returned')
     group by oi.product_id, oi.product_title
     order by qty desc limit 8
  ) t;

  select count(*) into v_low_count from public.product_variants v where v.stock_qty <= v.low_stock_threshold;
  select coalesce(jsonb_agg(l order by l.stock_qty asc), '[]'::jsonb) into v_low
  from (
    select v.id as variant_id, p.title_en, p.slug, v.sku, v.option_value, v.stock_qty, v.low_stock_threshold
      from public.product_variants v join public.products p on p.id = v.product_id
     where v.stock_qty <= v.low_stock_threshold and p.status = 'active'
     order by v.stock_qty asc limit 10
  ) l;

  select count(*) into v_review from public.orders where needs_review and status not in ('cancelled','delivered','returned','refunded');
  select count(*) into v_carts from public.carts where created_at >= v_from and created_at < v_now;

  return jsonb_build_object(
    'range', jsonb_build_object('days', p_days, 'from', v_from, 'to', v_now),
    'current', v_cur,
    'previous', v_prev,
    'aov_bdt', case when (v_cur->>'orders')::int > 0 then ((v_cur->>'revenue_bdt')::numeric / (v_cur->>'orders')::int)::int else 0 end,
    'carts', v_carts,
    'pending_review', v_review,
    'low_stock_count', v_low_count,
    'low_stock', v_low,
    'top_products', v_top,
    'series', v_series
  );
end;
$$;
revoke execute on function public.admin_dashboard_stats(int) from public, anon, authenticated;
