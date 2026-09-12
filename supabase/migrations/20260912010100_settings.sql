-- 20260912010100_settings.sql
-- Key/value store settings (BUILD_PROMPT §4.7). Brand values, contact details,
-- SMS templates and thresholds are read from here at runtime (CLAUDE.md rule 9).
-- Rows are inserted by the seed engine (src/lib/seed/settings.ts), not here.

create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,   -- readable by the storefront (anon)
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.settings');

alter table public.settings enable row level security;

drop policy if exists "settings: public read public keys" on public.settings;
create policy "settings: public read public keys" on public.settings
  for select to anon, authenticated using (is_public = true);

drop policy if exists "settings: admin all" on public.settings;
create policy "settings: admin all" on public.settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
