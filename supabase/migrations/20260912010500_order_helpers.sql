-- 20260912010500_order_helpers.sql
-- Atomic helpers used by order placement (service role only).

-- Adjust stock and record the movement in one statement pair.
-- Returns the new stock_qty. Raises when the result would go negative.
create or replace function public.adjust_stock(p_variant uuid, p_delta int, p_reason text, p_order uuid default null, p_actor uuid default null, p_note text default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_new int;
begin
  update public.product_variants
     set stock_qty = stock_qty + p_delta
   where id = p_variant
   returning stock_qty into v_new;
  if not found then
    raise exception 'variant % not found', p_variant;
  end if;
  if v_new < 0 then
    raise exception 'insufficient stock for variant %', p_variant using errcode = 'check_violation';
  end if;
  insert into public.stock_movements (variant_id, delta, reason, order_id, actor_id, note)
  values (p_variant, p_delta, p_reason, p_order, p_actor, p_note);
  return v_new;
end;
$$;

create or replace function public.increment_coupon_usage(p_coupon uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_new int;
begin
  update public.coupons set times_used = times_used + 1 where id = p_coupon returning times_used into v_new;
  return coalesce(v_new, 0);
end;
$$;

create or replace function public.increment_customer_orders(p_customer uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_new int;
begin
  update public.customers set total_orders = total_orders + 1 where id = p_customer returning total_orders into v_new;
  return coalesce(v_new, 0);
end;
$$;

revoke execute on function public.adjust_stock(uuid, int, text, uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.increment_coupon_usage(uuid) from public, anon, authenticated;
revoke execute on function public.increment_customer_orders(uuid) from public, anon, authenticated;
