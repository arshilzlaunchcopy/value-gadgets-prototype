-- 20260913000100_phase12_fraud_courier.sql
-- Phase 12: COD fraud defense tables (BUILD_PROMPT §4.6), courier reconciliation
-- (PART2 §14.1), OTP re-verification flag, polling index.

-- ---------------------------------------------------------------- blocked_entities
create table if not exists public.blocked_entities (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('phone', 'ip', 'email', 'device')),
  value text not null,                       -- phone: E.164; ip: dotted/colon form; email: lower-case
  reason text,
  blocked_by uuid,
  expires_at timestamptz,                    -- null = permanent
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (type, value)
);
select public.apply_updated_at('public.blocked_entities');
create index if not exists blocked_entities_lookup_idx on public.blocked_entities (type, value);

alter table public.blocked_entities enable row level security;
drop policy if exists "blocked_entities: admin all" on public.blocked_entities;
create policy "blocked_entities: admin all" on public.blocked_entities
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- -------------------------------------------------------------------- fraud_rules
-- One row per scoring rule. `key` is what the scorer looks up; score_delta and
-- is_active are editable from the admin so thresholds are never constants.
create table if not exists public.fraud_rules (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  rule jsonb not null default '{}'::jsonb,   -- rule parameters, e.g. {"ratio": 0.4, "min_orders": 3}
  score_delta int not null default 0,
  is_active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.fraud_rules');

alter table public.fraud_rules enable row level security;
drop policy if exists "fraud_rules: admin all" on public.fraud_rules;
create policy "fraud_rules: admin all" on public.fraud_rules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------ courier_reconciliation
create table if not exists public.courier_reconciliation (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  courier_code text not null,
  expected_cod_bdt int not null default 0,
  received_cod_bdt int not null default 0,
  delivered_count int not null default 0,
  returned_count int not null default 0,
  variance_bdt int not null default 0,
  notes text,
  reconciled_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (date, courier_code)
);
select public.apply_updated_at('public.courier_reconciliation');

alter table public.courier_reconciliation enable row level security;
drop policy if exists "courier_reconciliation: admin all" on public.courier_reconciliation;
create policy "courier_reconciliation: admin all" on public.courier_reconciliation
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------------------ orders
-- Score >= reverify threshold: the phone must be re-verified before confirmation (§4.6).
alter table public.orders add column if not exists otp_reverify_required boolean not null default false;

-- ---------------------------------------------------------------------- shipments
-- Polling fallback (PART2 §14.4) scans open shipments by last poll time.
create index if not exists shipments_poll_idx on public.shipments (last_polled_at)
  where normalized_status in ('created', 'picked', 'in_transit', 'out_for_delivery', 'on_hold');
