-- 20260912020200_seo.sql
-- SEO tables (BUILD_PROMPT §4.7): per-entity meta and redirect management.

create table if not exists public.seo_meta (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('product', 'category', 'collection', 'page', 'post', 'home')),
  entity_id uuid,                        -- null for 'home'
  locale text not null default 'en' check (locale in ('en', 'bn')),
  meta_title text,
  meta_description text,
  og_title text,
  og_description text,
  og_image_url text,
  canonical_url text,
  robots text not null default 'index,follow',
  schema_override jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (entity_type, entity_id, locale)
);
select public.apply_updated_at('public.seo_meta');
alter table public.seo_meta enable row level security;
drop policy if exists "seo_meta: public read" on public.seo_meta;
create policy "seo_meta: public read" on public.seo_meta for select to anon, authenticated using (true);
drop policy if exists "seo_meta: admin all" on public.seo_meta;
create policy "seo_meta: admin all" on public.seo_meta
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.redirects (
  id uuid primary key default gen_random_uuid(),
  from_path text not null unique,
  to_path text not null,
  status_code int not null default 301 check (status_code in (301, 302, 410)),
  hit_count int not null default 0,
  last_hit_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.redirects');
alter table public.redirects enable row level security;
drop policy if exists "redirects: public read active" on public.redirects;
create policy "redirects: public read active" on public.redirects for select to anon, authenticated using (is_active = true);
drop policy if exists "redirects: admin all" on public.redirects;
create policy "redirects: admin all" on public.redirects
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
