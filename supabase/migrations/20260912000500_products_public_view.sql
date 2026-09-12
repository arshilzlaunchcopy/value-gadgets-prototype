-- 20260912000500_products_public_view.sql
-- Public read views that OMIT product_variants.cost_bdt (BUILD_PROMPT §5).
-- security_invoker = true so the caller's RLS still applies (anon sees active only).
-- The storefront must read from these views, never from product_variants directly.

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
  v.low_stock_threshold,
  v.weight_grams,
  v.is_default,
  v.position,
  v.created_at,
  v.updated_at
from public.product_variants v;

create or replace view public.products_public
with (security_invoker = true) as
select
  p.id,
  p.brand_id,
  b.name  as brand_name,
  b.slug  as brand_slug,
  p.title_en,
  p.title_bn,
  p.slug,
  p.description_en,
  p.description_bn,
  p.short_description,
  p.specs,
  p.highlights,
  p.status,
  p.is_featured,
  p.warranty_months,
  p.video_url,
  p.published_at,
  p.created_at,
  p.updated_at,
  agg.min_price_bdt,
  agg.max_price_bdt,
  agg.max_compare_at_price_bdt,
  agg.total_stock,
  agg.variant_count,
  img.url         as primary_image_url,
  img.alt_text_en as primary_image_alt
from public.products p
left join public.brands b on b.id = p.brand_id
left join lateral (
  select
    min(v.price_bdt)            as min_price_bdt,
    max(v.price_bdt)            as max_price_bdt,
    max(v.compare_at_price_bdt) as max_compare_at_price_bdt,
    coalesce(sum(v.stock_qty), 0)::int as total_stock,
    count(*)::int               as variant_count
  from public.product_variants v
  where v.product_id = p.id
) agg on true
left join lateral (
  select i.url, i.alt_text_en
  from public.product_images i
  where i.product_id = p.id
  order by i.position asc, i.created_at asc
  limit 1
) img on true
where p.status = 'active';

grant select on public.product_variants_public to anon, authenticated;
grant select on public.products_public to anon, authenticated;

comment on view public.products_public is
  'Storefront read model. Intentionally omits product_variants.cost_bdt.';
comment on view public.product_variants_public is
  'Storefront variant read model. Intentionally omits cost_bdt.';
