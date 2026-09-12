-- 20260912000200_catalog.sql
-- Catalog tables (BUILD_PROMPT §4.1) + full-text search (§4.9).
-- Money is integer taka. No floats.

-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete set null,
  name_en text not null,
  name_bn text,
  slug text not null unique,
  description_en text,
  description_bn text,
  image_url text,
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.categories');
create index if not exists categories_parent_idx on public.categories (parent_id);

-- ---------------------------------------------------------------------------
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.brands');

-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id) on delete set null,
  title_en text not null,
  title_bn text,
  slug text not null unique,
  description_en text,
  description_bn text,
  short_description text,
  specs jsonb not null default '[]'::jsonb,        -- [{label, value}]
  highlights text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  is_featured boolean not null default false,
  warranty_months int not null default 0 check (warranty_months >= 0),
  video_url text,
  published_at timestamptz,
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title_en, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(title_bn, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(short_description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(public.immutable_array_to_string(highlights, ' '), '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.products');
create index if not exists products_search_idx on public.products using gin (search_vector);
create index if not exists products_status_idx on public.products (status);
create index if not exists products_brand_idx on public.products (brand_id);

-- ---------------------------------------------------------------------------
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  option_name text,                 -- e.g. "Color"
  option_value text,                -- e.g. "Space Grey"
  price_bdt int not null check (price_bdt >= 0),
  compare_at_price_bdt int check (compare_at_price_bdt is null or compare_at_price_bdt >= 0),
  cost_bdt int check (cost_bdt is null or cost_bdt >= 0),   -- admin-only; never exposed publicly
  stock_qty int not null default 0,
  low_stock_threshold int not null default 5,
  weight_grams int,
  is_default boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.product_variants');
create index if not exists product_variants_product_idx on public.product_variants (product_id);

-- ---------------------------------------------------------------------------
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  url text not null,
  alt_text_en text not null,
  alt_text_bn text,
  width int,
  height int,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.product_images');
create index if not exists product_images_product_idx on public.product_images (product_id, position);

-- ---------------------------------------------------------------------------
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  title_en text not null,
  title_bn text,
  slug text not null unique,
  description_en text,
  rules jsonb,
  is_automatic boolean not null default false,
  image_url text,
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.apply_updated_at('public.collections');

-- ---------------------------------------------------------------------------
create table if not exists public.collection_products (
  collection_id uuid not null references public.collections(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection_id, product_id)
);
select public.apply_updated_at('public.collection_products');

-- ---------------------------------------------------------------------------
create table if not exists public.product_categories (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, category_id)
);
select public.apply_updated_at('public.product_categories');
create index if not exists product_categories_category_idx on public.product_categories (category_id);
