-- 20260913000200_phase13_landing.sql
-- Phase 13: Facebook-traffic landing pages (PART2 §15.2) with A/B variants,
-- optional OTP, per-page pixel event; newsletter capture; order attribution.

create table if not exists public.landing_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  product_id uuid references public.products(id) on delete set null,   -- default product for quick_order_form
  status text not null default 'draft' check (status in ('draft', 'published')),
  chrome text not null default 'minimal' check (chrome in ('none', 'minimal')),
  otp_mode text not null default 'above_threshold' check (otp_mode in ('never', 'always', 'above_threshold')),
  otp_threshold_bdt int not null default 3000 check (otp_threshold_bdt >= 0),
  pixel_event text,                                                      -- Meta Pixel event override, e.g. 'Lead'
  ab_enabled boolean not null default false,
  variant_b_id uuid not null unique default gen_random_uuid(),           -- content_blocks.target_id for variant B
  views_a int not null default 0,
  views_b int not null default 0,
  meta_title text,
  meta_description text,
  og_image_url text,
  created_by uuid,
  updated_by uuid,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.landing_pages');
create index if not exists landing_pages_status_idx on public.landing_pages (status);

alter table public.landing_pages enable row level security;
drop policy if exists "landing_pages: public read published" on public.landing_pages;
create policy "landing_pages: public read published" on public.landing_pages
  for select to anon, authenticated using (status = 'published');
drop policy if exists "landing_pages: admin all" on public.landing_pages;
create policy "landing_pages: admin all" on public.landing_pages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- View counter, service-role only (called from the landing route handler)
create or replace function public.increment_landing_view(p_id uuid, p_variant text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.landing_pages
     set views_a = views_a + case when p_variant = 'a' then 1 else 0 end,
         views_b = views_b + case when p_variant = 'b' then 1 else 0 end
   where id = p_id;
$$;
revoke execute on function public.increment_landing_view(uuid, text) from public, anon, authenticated;

-- ------------------------------------------------------------ newsletter_subscribers
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  phone text unique,
  source text,                          -- page the form was on
  locale text not null default 'en' check (locale in ('en', 'bn')),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email is not null or phone is not null)
);
select public.apply_updated_at('public.newsletter_subscribers');
alter table public.newsletter_subscribers enable row level security;
-- writes go through a server action with the service role; admins read/manage
drop policy if exists "newsletter_subscribers: admin all" on public.newsletter_subscribers;
create policy "newsletter_subscribers: admin all" on public.newsletter_subscribers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------------------ orders
alter table public.orders add column if not exists landing_page_id uuid references public.landing_pages(id) on delete set null;
alter table public.orders add column if not exists ab_variant text check (ab_variant is null or ab_variant in ('a', 'b'));
alter table public.orders add column if not exists source text not null default 'web' check (source in ('web', 'landing', 'manual', 'api'));
create index if not exists orders_landing_idx on public.orders (landing_page_id) where landing_page_id is not null;
