-- 20260912020100_content.sql
-- Editable content system (BUILD_PROMPT_PART2 §13.3), navigation, theme, media.
-- Draft/publish separation: content_drafts is the working copy, content_blocks the live rows.

create table if not exists public.content_blocks (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('template', 'instance')),
  page_type text not null check (page_type in ('home', 'product', 'category', 'collection', 'page', 'landing', 'custom')),
  target_id uuid,                        -- null + template = every page of that type; set + instance = one entity
  block_type text not null,
  position int not null default 0,
  settings jsonb not null default '{}'::jsonb,
  is_visible boolean not null default true,
  visible_from timestamptz,
  visible_until timestamptz,
  locale text check (locale in ('en', 'bn')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.content_blocks');
create index if not exists content_blocks_page_idx on public.content_blocks (page_type, target_id, position);

alter table public.content_blocks enable row level security;
drop policy if exists "content_blocks: public read visible" on public.content_blocks;
create policy "content_blocks: public read visible" on public.content_blocks
  for select to anon, authenticated using (is_visible = true);
drop policy if exists "content_blocks: admin all" on public.content_blocks;
create policy "content_blocks: admin all" on public.content_blocks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Working copy per page (never seen by the storefront)
create table if not exists public.content_drafts (
  id uuid primary key default gen_random_uuid(),
  page_type text not null,
  target_id uuid,
  blocks jsonb not null default '[]'::jsonb,   -- ordered block array (same shape as content_blocks rows)
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (page_type, target_id)
);
select public.apply_updated_at('public.content_drafts');
alter table public.content_drafts enable row level security;
drop policy if exists "content_drafts: admin all" on public.content_drafts;
create policy "content_drafts: admin all" on public.content_drafts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.content_revisions (
  id uuid primary key default gen_random_uuid(),
  page_type text not null,
  target_id uuid,
  snapshot jsonb not null,               -- full ordered block array at publish time
  label text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.content_revisions');
create index if not exists content_revisions_page_idx on public.content_revisions (page_type, target_id, created_at desc);
alter table public.content_revisions enable row level security;
drop policy if exists "content_revisions: admin all" on public.content_revisions;
create policy "content_revisions: admin all" on public.content_revisions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Publish: swap live rows for a page, snapshot a revision, clear the draft.
-- Service-role only (execute revoked); the app checks the admin session first.
create or replace function public.publish_page(p_page_type text, p_target_id uuid, p_blocks jsonb, p_label text default null, p_actor uuid default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope text := case when p_target_id is null then 'template' else 'instance' end;
  n int;
begin
  delete from public.content_blocks
   where page_type = p_page_type and target_id is not distinct from p_target_id;

  insert into public.content_blocks (scope, page_type, target_id, block_type, position, settings, is_visible, visible_from, visible_until, locale, created_by, updated_by)
  select v_scope, p_page_type, p_target_id,
         b->>'block_type',
         (ord - 1)::int,
         coalesce(b->'settings', '{}'::jsonb),
         coalesce((b->>'is_visible')::boolean, true),
         nullif(b->>'visible_from', '')::timestamptz,
         nullif(b->>'visible_until', '')::timestamptz,
         nullif(b->>'locale', ''),
         p_actor, p_actor
    from jsonb_array_elements(coalesce(p_blocks, '[]'::jsonb)) with ordinality as t(b, ord);
  get diagnostics n = row_count;

  insert into public.content_revisions (page_type, target_id, snapshot, label, created_by)
  values (p_page_type, p_target_id, coalesce(p_blocks, '[]'::jsonb), p_label, p_actor);

  delete from public.content_drafts where page_type = p_page_type and target_id is not distinct from p_target_id;
  return n;
end;
$$;
revoke execute on function public.publish_page(text, uuid, jsonb, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- navigation
create table if not exists public.navigation_menus (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique,           -- 'main', 'mobile', 'footer_col_1'..'footer_col_4', 'topbar'
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.navigation_menus');
alter table public.navigation_menus enable row level security;
drop policy if exists "navigation_menus: public read" on public.navigation_menus;
create policy "navigation_menus: public read" on public.navigation_menus for select to anon, authenticated using (true);
drop policy if exists "navigation_menus: admin all" on public.navigation_menus;
create policy "navigation_menus: admin all" on public.navigation_menus
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.navigation_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.navigation_menus(id) on delete cascade,
  parent_id uuid references public.navigation_items(id) on delete cascade,
  label_en text not null,
  label_bn text,
  link_type text not null default 'url' check (link_type in ('url', 'category', 'collection', 'product', 'page', 'post', 'search')),
  link_target text,                      -- slug or URL; resolved to href at render
  icon text,
  badge_label text,
  badge_color text,
  is_mega boolean not null default false,
  mega_layout jsonb,                     -- {columns:[{heading, links:[{label, link_type, link_target}]}], featured:{image_url, heading, href}}
  position int not null default 0,
  opens_new_tab boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.navigation_items');
create index if not exists navigation_items_menu_idx on public.navigation_items (menu_id, parent_id, position);
alter table public.navigation_items enable row level security;
drop policy if exists "navigation_items: public read" on public.navigation_items;
create policy "navigation_items: public read" on public.navigation_items for select to anon, authenticated using (true);
drop policy if exists "navigation_items: admin all" on public.navigation_items;
create policy "navigation_items: admin all" on public.navigation_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------------- theme
create table if not exists public.theme_settings (
  key text primary key,                  -- 'announcement' | 'header' | 'footer' | 'brand'
  value jsonb not null,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.theme_settings');
alter table public.theme_settings enable row level security;
drop policy if exists "theme_settings: public read" on public.theme_settings;
create policy "theme_settings: public read" on public.theme_settings for select to anon, authenticated using (true);
drop policy if exists "theme_settings: admin all" on public.theme_settings;
create policy "theme_settings: admin all" on public.theme_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------------- media
create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  url text not null,                     -- JPEG fallback URL
  manifest jsonb,
  blur_data_url text,
  width int,
  height int,
  bytes int,
  alt_text text,
  filename text,
  folder text not null default 'general',
  content_hash text not null unique,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.media_assets');
create index if not exists media_assets_folder_idx on public.media_assets (folder, created_at desc);
alter table public.media_assets enable row level security;
drop policy if exists "media_assets: public read" on public.media_assets;
create policy "media_assets: public read" on public.media_assets for select to anon, authenticated using (true);
drop policy if exists "media_assets: admin all" on public.media_assets;
create policy "media_assets: admin all" on public.media_assets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
