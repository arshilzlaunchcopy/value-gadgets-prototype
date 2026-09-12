-- 20260912000400_rls_catalog_customers.sql
-- RLS per BUILD_PROMPT §5 policy matrix for catalog + customer tables.
-- Convention: "public" = anon + authenticated. Admin = public.is_admin().

-- ===========================================================================
-- categories / brands / collections: public SELECT where is_active, admin ALL
-- ===========================================================================
alter table public.categories enable row level security;
drop policy if exists "categories: public read active" on public.categories;
create policy "categories: public read active" on public.categories
  for select to anon, authenticated using (is_active = true);
drop policy if exists "categories: admin all" on public.categories;
create policy "categories: admin all" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.brands enable row level security;
drop policy if exists "brands: public read active" on public.brands;
create policy "brands: public read active" on public.brands
  for select to anon, authenticated using (is_active = true);
drop policy if exists "brands: admin all" on public.brands;
create policy "brands: admin all" on public.brands
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.collections enable row level security;
drop policy if exists "collections: public read active" on public.collections;
create policy "collections: public read active" on public.collections
  for select to anon, authenticated using (is_active = true);
drop policy if exists "collections: admin all" on public.collections;
create policy "collections: admin all" on public.collections
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- products / variants / images: public SELECT where product active, admin ALL
-- ===========================================================================
alter table public.products enable row level security;
drop policy if exists "products: public read active" on public.products;
create policy "products: public read active" on public.products
  for select to anon, authenticated using (status = 'active');
drop policy if exists "products: admin all" on public.products;
create policy "products: admin all" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.product_variants enable row level security;
drop policy if exists "product_variants: public read active" on public.product_variants;
create policy "product_variants: public read active" on public.product_variants
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.status = 'active'));
drop policy if exists "product_variants: admin all" on public.product_variants;
create policy "product_variants: admin all" on public.product_variants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.product_images enable row level security;
drop policy if exists "product_images: public read active" on public.product_images;
create policy "product_images: public read active" on public.product_images
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.status = 'active'));
drop policy if exists "product_images: admin all" on public.product_images;
create policy "product_images: admin all" on public.product_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.collection_products enable row level security;
drop policy if exists "collection_products: public read" on public.collection_products;
create policy "collection_products: public read" on public.collection_products
  for select to anon, authenticated
  using (
    exists (select 1 from public.collections c where c.id = collection_id and c.is_active = true)
    and exists (select 1 from public.products p where p.id = product_id and p.status = 'active')
  );
drop policy if exists "collection_products: admin all" on public.collection_products;
create policy "collection_products: admin all" on public.collection_products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.product_categories enable row level security;
drop policy if exists "product_categories: public read" on public.product_categories;
create policy "product_categories: public read" on public.product_categories
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.status = 'active'));
drop policy if exists "product_categories: admin all" on public.product_categories;
create policy "product_categories: admin all" on public.product_categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- customers: none for anon; customer SELECT/UPDATE own row; admin ALL
-- ===========================================================================
alter table public.customers enable row level security;
drop policy if exists "customers: self select" on public.customers;
create policy "customers: self select" on public.customers
  for select to authenticated using (id = auth.uid());
drop policy if exists "customers: self update" on public.customers;
create policy "customers: self update" on public.customers
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "customers: admin all" on public.customers;
create policy "customers: admin all" on public.customers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- addresses: customer ALL own; admin SELECT
-- ===========================================================================
alter table public.addresses enable row level security;
drop policy if exists "addresses: self all" on public.addresses;
create policy "addresses: self all" on public.addresses
  for all to authenticated using (customer_id = auth.uid()) with check (customer_id = auth.uid());
drop policy if exists "addresses: admin select" on public.addresses;
create policy "addresses: admin select" on public.addresses
  for select to authenticated using (public.is_admin());

-- ===========================================================================
-- bd_locations: reference data, public SELECT; admin ALL
-- ===========================================================================
alter table public.bd_locations enable row level security;
drop policy if exists "bd_locations: public read" on public.bd_locations;
create policy "bd_locations: public read" on public.bd_locations
  for select to anon, authenticated using (true);
drop policy if exists "bd_locations: admin all" on public.bd_locations;
create policy "bd_locations: admin all" on public.bd_locations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- otp_codes: RLS ON, ZERO POLICIES - service-role-only by design.
-- ===========================================================================
alter table public.otp_codes enable row level security;
comment on table public.otp_codes is
  'Phone OTP codes (hashed). RLS enabled with NO policies on purpose: this table is '
  'service-role-only by design. Only server-side route handlers using the admin client '
  'may read or write it. Do not add anon/authenticated policies.';
