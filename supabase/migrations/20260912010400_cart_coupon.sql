-- 20260912010400_cart_coupon.sql
-- A cart remembers the coupon the shopper applied; it is re-validated server-side
-- on every total calculation and again at order placement.
alter table public.carts add column if not exists coupon_code text;
