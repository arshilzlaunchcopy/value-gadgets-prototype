-- 20260913000300_phase14_seo.sql
-- Phase 14: SEO system (BUILD_PROMPT §7). Pages + posts content tables (§4.7),
-- GTIN/MPN on variants for feeds and Product JSON-LD, per-category filter
-- indexing toggle (§7.5), analytics event log for the server-side CAPI adapter.

-- ------------------------------------------------------------------ variants
alter table public.product_variants add column if not exists gtin text;
alter table public.product_variants add column if not exists mpn text;

-- append the new columns to the public read model (order preserved, appended at the end)
create or replace view public.product_variants_public
with (security_invoker = true) as
select
  v.id,
  v.product_id,
  v.sku,
  v.option_name,
  v.option_value,
  v.price_bdt,
  v.compare_at_price_bdt,
  v.stock_qty,
  greatest(v.stock_qty - public.reserved_qty(v.id), 0)::int as available_qty,
  v.low_stock_threshold,
  v.weight_grams,
  v.is_default,
  v.position,
  v.created_at,
  v.updated_at,
  v.gtin,
  v.mpn
from public.product_variants v;
grant select on public.product_variants_public to anon, authenticated;

-- ---------------------------------------------------------------- categories
-- §7.5: filtered category URLs canonicalise to the base category unless the
-- admin says the filter combinations have search volume.
alter table public.categories add column if not exists index_filters boolean not null default false;

-- --------------------------------------------------------------------- pages
create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_en text not null,
  title_bn text,
  content_en text,                      -- markdown
  content_bn text,                      -- markdown (DBID needs Bangla T&C, PART2 §15.3)
  is_published boolean not null default true,
  position int not null default 0,
  show_in_footer boolean not null default true,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.pages');
alter table public.pages enable row level security;
drop policy if exists "pages: public read published" on public.pages;
create policy "pages: public read published" on public.pages
  for select to anon, authenticated using (is_published = true);
drop policy if exists "pages: admin all" on public.pages;
create policy "pages: admin all" on public.pages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------------- posts
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_en text not null,
  excerpt_en text,
  content_en text,                      -- markdown
  title_bn text,
  excerpt_bn text,
  content_bn text,
  cover_image_url text,
  cover_alt text,
  author_name text,
  reading_minutes int not null default 3,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  related_product_ids uuid[] not null default '{}',
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.posts');
create index if not exists posts_published_idx on public.posts (status, published_at desc);
alter table public.posts enable row level security;
drop policy if exists "posts: public read published" on public.posts;
create policy "posts: public read published" on public.posts
  for select to anon, authenticated using (status = 'published');
drop policy if exists "posts: admin all" on public.posts;
create policy "posts: admin all" on public.posts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------- analytics_events
-- Server-side conversion events (Meta CAPI / GA4 MP). The mock adapter logs here;
-- the real adapter logs the request + response for dedup audits (event_id).
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,               -- 'meta_capi' | 'ga4' | 'mock'
  event_name text not null,
  event_id text not null,
  order_id uuid references public.orders(id) on delete set null,
  payload jsonb,
  response jsonb,
  status text not null default 'sent' check (status in ('sent', 'failed', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, event_name, event_id)
);
select public.apply_updated_at('public.analytics_events');
alter table public.analytics_events enable row level security;
drop policy if exists "analytics_events: admin select" on public.analytics_events;
create policy "analytics_events: admin select" on public.analytics_events
  for select to authenticated using (public.is_admin());

-- --------------------------------------------------------------- redirects
-- Hit counting from the 404 path is service-role; nothing to add. Index the lookup.
create index if not exists redirects_active_from_idx on public.redirects (from_path) where is_active;
