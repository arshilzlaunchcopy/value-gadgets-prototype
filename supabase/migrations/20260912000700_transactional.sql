-- 20260912000700_transactional.sql
-- Cart, orders, payments, discounts, shipping, reviews, stock, couriers, shipments
-- (BUILD_PROMPT §4.3, §4.4, §4.5, §4.8; BUILD_PROMPT_PART2 §14.1).
-- order_items store SNAPSHOTS. Money is integer taka.

-- ---------------------------------------------------------------------------
-- Discounts + shipping (needed as FK targets / for totals)
-- ---------------------------------------------------------------------------
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  type text not null check (type in ('percentage', 'fixed', 'free_shipping')),
  value int not null default 0 check (value >= 0),
  min_order_bdt int not null default 0 check (min_order_bdt >= 0),
  max_discount_bdt int check (max_discount_bdt is null or max_discount_bdt >= 0),
  usage_limit int,
  usage_limit_per_customer int not null default 1,
  times_used int not null default 0,
  applies_to jsonb not null default '{"all": true}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.coupons');

create table if not exists public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  districts text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.shipping_zones');

create table if not exists public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.shipping_zones(id) on delete cascade,
  name text not null,
  rate_bdt int not null check (rate_bdt >= 0),
  free_above_bdt int check (free_above_bdt is null or free_above_bdt >= 0),
  estimated_days text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.shipping_rates');

-- ---------------------------------------------------------------------------
-- Carts (server-only via service role; keyed by httpOnly cookie)
-- ---------------------------------------------------------------------------
create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  session_token text not null unique,
  customer_id uuid references public.customers(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.carts');

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity int not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);
select public.apply_updated_at('public.cart_items');

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,                       -- VGBD-YYMMDD-XXXX
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'pending_payment' check (status in (
    'pending_payment', 'awaiting_advance', 'confirmed', 'processing', 'packed',
    'shipped', 'delivered', 'cancelled', 'returned', 'refunded'
  )),
  payment_method text not null check (payment_method in ('sslcommerz', 'cod')),
  payment_status text not null default 'unpaid' check (payment_status in (
    'unpaid', 'paid', 'partially_refunded', 'refunded', 'failed'
  )),
  subtotal_bdt int not null default 0 check (subtotal_bdt >= 0),
  discount_bdt int not null default 0 check (discount_bdt >= 0),
  shipping_bdt int not null default 0 check (shipping_bdt >= 0),
  total_bdt int not null default 0 check (total_bdt >= 0),
  coupon_code text,
  coupon_id uuid references public.coupons(id) on delete set null,
  shipping_address jsonb not null,                         -- SNAPSHOT
  customer_phone text not null,
  customer_name text,
  customer_email text,
  customer_note text,
  admin_note text,
  fraud_score int check (fraud_score is null or (fraud_score between 0 and 100)),
  fraud_flags jsonb not null default '[]'::jsonb,
  needs_review boolean not null default false,
  is_phone_verified boolean not null default false,
  courier text,
  tracking_id text,
  courier_response jsonb,
  placed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  landing_page text,
  referrer text,
  ip inet,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.orders');
create index if not exists orders_customer_idx on public.orders (customer_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_placed_idx on public.orders (placed_at desc);
create index if not exists orders_phone_idx on public.orders (customer_phone);
create index if not exists orders_review_idx on public.orders (needs_review) where needs_review;

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  product_title text not null,                             -- SNAPSHOT
  variant_label text,                                      -- SNAPSHOT
  sku text,                                                -- SNAPSHOT
  unit_price_bdt int not null check (unit_price_bdt >= 0), -- SNAPSHOT
  quantity int not null check (quantity > 0),
  line_total_bdt int not null check (line_total_bdt >= 0),
  image_url text,                                          -- SNAPSHOT
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.order_items');
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_variant_idx on public.order_items (variant_id);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  actor_id uuid,
  actor_type text not null default 'system' check (actor_type in ('admin', 'customer', 'system')),
  note text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.order_events');
create index if not exists order_events_order_idx on public.order_events (order_id, created_at);

-- ---------------------------------------------------------------------------
-- Payments - every gateway payload stored raw
-- ---------------------------------------------------------------------------
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  gateway text not null default 'sslcommerz',
  gateway_txn_id text,
  val_id text,
  bank_txn_id text,
  amount_bdt int not null check (amount_bdt >= 0),
  currency text not null default 'BDT',
  card_type text,
  card_issuer text,
  status text not null default 'initiated' check (status in (
    'initiated', 'success', 'failed', 'cancelled', 'validated', 'refunded'
  )),
  raw_initiate_response jsonb,
  raw_ipn_payload jsonb,
  raw_validation_response jsonb,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.payment_transactions');
create unique index if not exists payment_transactions_gateway_txn_idx
  on public.payment_transactions (gateway, gateway_txn_id) where gateway_txn_id is not null;
create index if not exists payment_transactions_order_idx on public.payment_transactions (order_id);

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  discount_bdt int not null default 0 check (discount_bdt >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.coupon_redemptions');

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  title text,
  body text,
  reviewer_name text,
  is_verified_purchase boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_reply text,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.reviews');
create index if not exists reviews_product_idx on public.reviews (product_id, status);

-- ---------------------------------------------------------------------------
-- Stock movements
-- ---------------------------------------------------------------------------
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  delta int not null,
  reason text not null,
  order_id uuid references public.orders(id) on delete set null,
  actor_id uuid,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.stock_movements');
create index if not exists stock_movements_variant_idx on public.stock_movements (variant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Couriers + shipments (PART2 §14.1)
-- ---------------------------------------------------------------------------
create table if not exists public.couriers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,            -- 'steadfast', 'pathao', 'redx', 'mock'
  name text not null,
  is_active boolean not null default true,
  is_default boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  supported_districts text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.couriers');

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  courier_code text not null,
  consignment_id text,
  tracking_code text,
  invoice_ref text,
  cod_amount_bdt int not null default 0 check (cod_amount_bdt >= 0),
  delivery_charge_bdt int check (delivery_charge_bdt is null or delivery_charge_bdt >= 0),
  status text,                          -- courier's raw status string
  normalized_status text not null default 'created' check (normalized_status in (
    'created', 'picked', 'in_transit', 'out_for_delivery',
    'delivered', 'partial_delivered', 'returned', 'cancelled', 'lost', 'on_hold'
  )),
  note text,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  raw_create_response jsonb,
  last_webhook_payload jsonb,
  last_polled_at timestamptz,
  next_transition_at timestamptz,       -- used by the mock courier auto-advance
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.shipments');
create index if not exists shipments_order_idx on public.shipments (order_id);
create index if not exists shipments_status_idx on public.shipments (normalized_status);
create index if not exists shipments_invoice_idx on public.shipments (invoice_ref);

create table if not exists public.courier_api_log (
  id uuid primary key default gen_random_uuid(),
  courier_code text not null,
  method text not null,
  endpoint text not null,
  request jsonb,
  response jsonb,
  status_code int,
  duration_ms int,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.courier_api_log');
create index if not exists courier_api_log_created_idx on public.courier_api_log (created_at desc);

create table if not exists public.courier_score_cache (
  phone text primary key,
  courier_code text not null,
  total_parcels int not null default 0,
  total_delivered int not null default 0,
  total_cancelled int not null default 0,
  success_ratio numeric(5, 2),
  fraud_report_count int not null default 0,
  raw jsonb,
  checked_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.courier_score_cache');
