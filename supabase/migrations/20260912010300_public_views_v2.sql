-- 20260912010300_public_views_v2.sql
-- Storefront read models v2: availability net of reservations, search vector,
-- rating aggregates, primary image manifest. Still NO cost_bdt.

drop view if exists public.products_public;
drop view if exists public.product_variants_public;

create view public.product_variants_public
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
  v.updated_at
from public.product_variants v;

create view public.products_public
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
  p.search_vector,
  agg.min_price_bdt,
  agg.max_price_bdt,
  agg.max_compare_at_price_bdt,
  agg.total_stock,
  agg.available_stock,
  (agg.available_stock > 0) as in_stock,
  agg.variant_count,
  r.avg_rating,
  r.review_count,
  img.url          as primary_image_url,
  img.alt_text_en  as primary_image_alt,
  img.manifest     as primary_image_manifest,
  img.blur_data_url as primary_image_blur,
  img.width        as primary_image_width,
  img.height       as primary_image_height
from public.products p
left join public.brands b on b.id = p.brand_id
left join lateral (
  select
    min(v.price_bdt)            as min_price_bdt,
    max(v.price_bdt)            as max_price_bdt,
    max(v.compare_at_price_bdt) as max_compare_at_price_bdt,
    coalesce(sum(v.stock_qty), 0)::int as total_stock,
    coalesce(sum(greatest(v.stock_qty - public.reserved_qty(v.id), 0)), 0)::int as available_stock,
    count(*)::int               as variant_count
  from public.product_variants v
  where v.product_id = p.id
) agg on true
left join lateral (
  select round(avg(rv.rating)::numeric, 2) as avg_rating, count(*)::int as review_count
  from public.reviews rv
  where rv.product_id = p.id and rv.status = 'approved'
) r on true
left join lateral (
  select i.url, i.alt_text_en, i.manifest, i.blur_data_url, i.width, i.height
  from public.product_images i
  where i.product_id = p.id
  order by i.position asc, i.created_at asc
  limit 1
) img on true
where p.status = 'active';

grant select on public.product_variants_public to anon, authenticated;
grant select on public.products_public to anon, authenticated;

comment on view public.products_public is 'Storefront read model v2. Intentionally omits product_variants.cost_bdt.';
comment on view public.product_variants_public is 'Storefront variant read model v2 (available_qty net of reservations). Omits cost_bdt.';
