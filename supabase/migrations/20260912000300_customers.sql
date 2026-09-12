-- 20260912000300_customers.sql
-- Customers, addresses, Bangladesh geography, OTP codes (BUILD_PROMPT §4.2).

create table if not exists public.customers (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text not null unique,          -- E.164, +8801XXXXXXXXX
  full_name text,
  email text,
  is_blocked boolean not null default false,
  block_reason text,
  total_orders int not null default 0,
  total_delivered int not null default 0,
  total_cancelled int not null default 0,
  total_returned int not null default 0,
  notes text,                          -- admin-only internal notes
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.customers');

-- ---------------------------------------------------------------------------
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  recipient_name text,
  phone text,
  division text,
  district text,
  upazila text,
  area text,
  street_address text not null,
  postcode text,
  landmark text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.addresses');
create index if not exists addresses_customer_idx on public.addresses (customer_id);

-- ---------------------------------------------------------------------------
-- Reference geography: division > district > upazila
create table if not exists public.bd_locations (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('division', 'district', 'upazila')),
  parent_id uuid references public.bd_locations(id) on delete cascade,
  name_en text not null,
  name_bn text,
  slug text not null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (level, slug)
);
select public.apply_updated_at('public.bd_locations');
create index if not exists bd_locations_parent_idx on public.bd_locations (parent_id);

-- ---------------------------------------------------------------------------
-- OTP codes for phone verification. Codes are stored hashed.
-- RLS is enabled with ZERO policies on purpose: only the service role
-- (server-side route handlers) may read or write this table.
create table if not exists public.otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.otp_codes');
create index if not exists otp_codes_phone_idx on public.otp_codes (phone, created_at desc);
