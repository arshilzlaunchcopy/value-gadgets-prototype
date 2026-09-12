-- 20260912001000_demo.sql
-- Demo-mode tables (BUILD_PROMPT_PART3 §20.1, §22).

-- SMS log. The mock SMS adapter writes here instead of sending. Kept in production
-- too (the real adapter logs every send) because an SMS audit trail is useful.
create table if not exists public.demo_sms_log (
  id uuid primary key default gen_random_uuid(),
  to_phone text not null,
  message text not null,
  kind text not null,                   -- 'otp' | 'order_confirmed' | 'shipped' | 'delivered' | 'abandoned_cart' | 'other'
  status text not null default 'sent' check (status in ('sent', 'failed')),
  provider text not null default 'mock',
  provider_ref text,
  error text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.demo_sms_log');
create index if not exists demo_sms_log_sent_idx on public.demo_sms_log (sent_at desc);

alter table public.demo_sms_log enable row level security;
drop policy if exists "demo_sms_log: admin select" on public.demo_sms_log;
create policy "demo_sms_log: admin select" on public.demo_sms_log
  for select to authenticated using (public.is_admin());

-- Demo control-panel settings (sms failure rate, courier speed, fraud override...).
-- RLS ON, ZERO POLICIES on purpose: service-role-only by design.
create table if not exists public.demo_settings (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.demo_settings');
alter table public.demo_settings enable row level security;
comment on table public.demo_settings is
  'Demo control panel state. RLS enabled with NO policies on purpose: service-role-only '
  'by design. Read/written only by server code through the admin client.';

insert into public.demo_settings (key, value) values
  ('sms_failure_rate',   '0.05'),
  ('courier_speed',      '"fast"'),
  ('courier_outage',     'false'),
  ('force_return_next',  'false'),
  ('courier_balance',    '25000'),
  ('fraud_score_override', 'null'),
  ('clock_offset_days',  '0')
on conflict (key) do nothing;
