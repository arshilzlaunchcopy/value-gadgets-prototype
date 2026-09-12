import "server-only";

import { unstable_cache } from "next/cache";
import type { Tables } from "@/lib/database.types";
import { toPicture, type PictureData } from "@/lib/media/picture";
import { createPublicClient } from "@/lib/supabase/public";

export const PAGE_SIZE = 24;
export const CATALOG_REVALIDATE = 3600;

type ProductRow = Tables<"products_public">;

export interface ProductSummary {
  id: string;
  slug: string;
  title_en: string;
  title_bn: string | null;
  brand_name: string | null;
  brand_slug: string | null;
  price_bdt: number;
  compare_at_bdt: number | null;
  in_stock: boolean;
  available_stock: number;
  avg_rating: number | null;
  review_count: number;
  is_featured: boolean;
  published_at: string | null;
  image: PictureData | null;
}

export interface CategorySummary {
  id: string;
  slug: string;
  name_en: string;
  name_bn: string | null;
  description_en: string | null;
  image_url: string | null;
  parent_id: string | null;
  position: number;
}

export type SortKey = "relevance" | "price_asc" | "price_desc" | "newest";

export interface ListFilters {
  brand?: string[];
  min?: number;
  max?: number;
  inStock?: boolean;
  sort?: SortKey;
  page?: number;
}

export interface FacetBrand {
  slug: string;
  name: string;
  count: number;
}

export interface ProductList {
  items: ProductSummary[];
  total: number;
  page: number;
  pageCount: number;
  brands: FacetBrand[];
  priceRange: { min: number; max: number } | null;
}

function toSummary(p: ProductRow): ProductSummary {
  return {
    id: p.id!,
    slug: p.slug!,
    title_en: p.title_en!,
    title_bn: p.title_bn,
    brand_name: p.brand_name,
    brand_slug: p.brand_slug,
    price_bdt: p.min_price_bdt ?? 0,
    compare_at_bdt: p.max_compare_at_price_bdt,
    in_stock: Boolean(p.in_stock),
    available_stock: p.available_stock ?? 0,
    avg_rating: p.avg_rating === null || p.avg_rating === undefined ? null : Number(p.avg_rating),
    review_count: p.review_count ?? 0,
    is_featured: Boolean(p.is_featured),
    published_at: p.published_at,
    image: toPicture(
      { url: p.primary_image_url, alt_text_en: p.primary_image_alt, manifest: p.primary_image_manifest, blur_data_url: p.primary_image_blur, width: p.primary_image_width, height: p.primary_image_height },
      p.title_en ?? "",
    ),
  };
}

const SUMMARY_COLUMNS =
  "id, slug, title_en, title_bn, brand_name, brand_slug, min_price_bdt, max_compare_at_price_bdt, in_stock, available_stock, avg_rating, review_count, is_featured, published_at, primary_image_url, primary_image_alt, primary_image_manifest, primary_image_blur, primary_image_width, primary_image_height";

// ---------------------------------------------------------------- categories

export const getNavCategories = unstable_cache(
  async (): Promise<CategorySummary[]> => {
    const { data } = await createPublicClient()
      .from("categories")
      .select("id, slug, name_en, name_bn, description_en, image_url, parent_id, position")
      .eq("is_active", true)
      .order("position");
    return (data ?? []) as CategorySummary[];
  },
  ["nav-categories"],
  { revalidate: CATALOG_REVALIDATE, tags: ["catalog"] },
);

export async function getCategoryBySlug(slug: string): Promise<CategorySummary | null> {
  const cats = await getNavCategories();
  return cats.find((c) => c.slug === slug) ?? null;
}

async function productIdsInCategory(categoryId: string): Promise<string[]> {
  const cats = await getNavCategories();
  const ids = [categoryId, ...cats.filter((c) => c.parent_id === categoryId).map((c) => c.id)];
  const { data } = await createPublicClient().from("product_categories").select("product_id").in("category_id", ids);
  return [...new Set((data ?? []).map((r) => r.product_id))];
}

// ------------------------------------------------------------------ listing

async function listProducts(idFilter: string[] | null, filters: ListFilters, searchQuery?: string): Promise<ProductList> {
  const supabase = createPublicClient();
  const page = Math.max(1, filters.page ?? 1);

  // facets: all products in scope (cheap columns)
  let facetQ = supabase.from("products_public").select("brand_slug, brand_name, min_price_bdt");
  if (idFilter) facetQ = facetQ.in("id", idFilter.length ? idFilter : ["00000000-0000-0000-0000-000000000000"]);
  if (searchQuery) facetQ = facetQ.textSearch("search_vector", searchQuery, { type: "websearch", config: "simple" });
  const { data: facetRows } = await facetQ;
  const brandMap = new Map<string, FacetBrand>();
  let pmin = Infinity;
  let pmax = -Infinity;
  for (const r of facetRows ?? []) {
    if (r.brand_slug && r.brand_name) {
      const b = brandMap.get(r.brand_slug) ?? { slug: r.brand_slug, name: r.brand_name, count: 0 };
      b.count++;
      brandMap.set(r.brand_slug, b);
    }
    if (r.min_price_bdt !== null) {
      pmin = Math.min(pmin, r.min_price_bdt);
      pmax = Math.max(pmax, r.min_price_bdt);
    }
  }

  let q = supabase.from("products_public").select(SUMMARY_COLUMNS, { count: "exact" });
  if (idFilter) q = q.in("id", idFilter.length ? idFilter : ["00000000-0000-0000-0000-000000000000"]);
  if (searchQuery) q = q.textSearch("search_vector", searchQuery, { type: "websearch", config: "simple" });
  if (filters.brand?.length) q = q.in("brand_slug", filters.brand);
  if (filters.min !== undefined) q = q.gte("min_price_bdt", filters.min);
  if (filters.max !== undefined) q = q.lte("min_price_bdt", filters.max);
  if (filters.inStock) q = q.eq("in_stock", true);

  switch (filters.sort ?? "relevance") {
    case "price_asc":
      q = q.order("min_price_bdt", { ascending: true, nullsFirst: false });
      break;
    case "price_desc":
      q = q.order("min_price_bdt", { ascending: false, nullsFirst: false });
      break;
    case "newest":
      q = q.order("published_at", { ascending: false, nullsFirst: false });
      break;
    default:
      q = q.order("is_featured", { ascending: false }).order("review_count", { ascending: false }).order("published_at", { ascending: false });
  }
  q = q.order("id");
  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await q.range(from, from + PAGE_SIZE - 1);
  const total = count ?? 0;
  return {
    items: (data ?? []).map((r) => toSummary(r as ProductRow)),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    brands: [...brandMap.values()].sort((a, b) => b.count - a.count),
    priceRange: Number.isFinite(pmin) ? { min: pmin, max: pmax } : null,
  };
}

export const getCategoryProducts = unstable_cache(
  async (categoryId: string, filters: ListFilters) => listProducts(await productIdsInCategory(categoryId), filters),
  ["category-products"],
  { revalidate: CATALOG_REVALIDATE, tags: ["catalog"] },
);

export interface CollectionSummary {
  id: string;
  slug: string;
  title_en: string;
  title_bn: string | null;
  description_en: string | null;
  image_url: string | null;
}

export const getCollectionBySlug = unstable_cache(
  async (slug: string): Promise<CollectionSummary | null> => {
    const { data } = await createPublicClient().from("collections").select("id, slug, title_en, title_bn, description_en, image_url").eq("slug", slug).eq("is_active", true).maybeSingle();
    return (data as CollectionSummary | null) ?? null;
  },
  ["collection"],
  { revalidate: CATALOG_REVALIDATE, tags: ["catalog"] },
);

export const getCollectionProducts = unstable_cache(
  async (collectionId: string, filters: ListFilters) => {
    const { data } = await createPublicClient().from("collection_products").select("product_id, position").eq("collection_id", collectionId).order("position");
    return listProducts((data ?? []).map((r) => r.product_id), filters);
  },
  ["collection-products"],
  { revalidate: CATALOG_REVALIDATE, tags: ["catalog"] },
);

export const searchProducts = unstable_cache(
  async (query: string, filters: ListFilters) => listProducts(null, filters, query),
  ["search-products"],
  { revalidate: 600, tags: ["catalog"] },
);

export const getAllCollections = unstable_cache(
  async (): Promise<CollectionSummary[]> => {
    const { data } = await createPublicClient().from("collections").select("id, slug, title_en, title_bn, description_en, image_url").eq("is_active", true).order("position");
    return (data ?? []) as CollectionSummary[];
  },
  ["collections"],
  { revalidate: CATALOG_REVALIDATE, tags: ["catalog"] },
);

// --------------------------------------------------------------------- home

export const getHomeData = unstable_cache(
  async () => {
    const supabase = createPublicClient();
    const [featured, newest, deals] = await Promise.all([
      supabase.from("products_public").select(SUMMARY_COLUMNS).eq("is_featured", true).order("review_count", { ascending: false }).limit(8),
      supabase.from("products_public").select(SUMMARY_COLUMNS).order("published_at", { ascending: false, nullsFirst: false }).limit(8),
      supabase.from("products_public").select(SUMMARY_COLUMNS).not("max_compare_at_price_bdt", "is", null).order("review_count", { ascending: false }).limit(8),
    ]);
    return {
      featured: (featured.data ?? []).map((r) => toSummary(r as ProductRow)),
      newest: (newest.data ?? []).map((r) => toSummary(r as ProductRow)),
      deals: (deals.data ?? []).map((r) => toSummary(r as ProductRow)),
    };
  },
  ["home-data"],
  { revalidate: CATALOG_REVALIDATE, tags: ["catalog"] },
);

// ---------------------------------------------------------------------- PDP

export interface VariantPublic {
  id: string;
  sku: string;
  option_name: string | null;
  option_value: string | null;
  price_bdt: number;
  compare_at_price_bdt: number | null;
  available_qty: number;
  low_stock_threshold: number;
  is_default: boolean;
  position: number;
}

export interface ProductImagePublic {
  id: string;
  variant_id: string | null;
  position: number;
  picture: PictureData;
}

export interface ReviewPublic {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  reviewer_name: string | null;
  is_verified_purchase: boolean;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
}

export interface ShippingEstimate {
  zone: string;
  districts: string[];
  rate_bdt: number;
  free_above_bdt: number | null;
  estimated_days: string | null;
}

export interface ProductDetail {
  product: ProductSummary & {
    description_en: string | null;
    short_description: string | null;
    specs: { label: string; value: string }[];
    highlights: string[];
    warranty_months: number;
    video_url: string | null;
    updated_at: string;
  };
  variants: VariantPublic[];
  images: ProductImagePublic[];
  reviews: ReviewPublic[];
  category: CategorySummary | null;
  related: ProductSummary[];
  shipping: ShippingEstimate[];
}

export const getShippingEstimates = unstable_cache(
  async (): Promise<ShippingEstimate[]> => {
    const { data } = await createPublicClient().from("shipping_zones").select("name, districts, shipping_rates(rate_bdt, free_above_bdt, estimated_days, position)").eq("is_active", true);
    return (data ?? [])
      .map((z) => {
        const rates = (z.shipping_rates ?? []) as { rate_bdt: number; free_above_bdt: number | null; estimated_days: string | null; position: number }[];
        const r = [...rates].sort((a, b) => a.position - b.position)[0];
        return r ? { zone: z.name, districts: z.districts, rate_bdt: r.rate_bdt, free_above_bdt: r.free_above_bdt, estimated_days: r.estimated_days } : null;
      })
      .filter((z): z is ShippingEstimate => z !== null)
      .sort((a, b) => a.rate_bdt - b.rate_bdt);
  },
  ["shipping-estimates"],
  { revalidate: CATALOG_REVALIDATE, tags: ["catalog", "settings"] },
);

export const getProductBySlug = unstable_cache(
  async (slug: string): Promise<ProductDetail | null> => {
    const supabase = createPublicClient();
    const { data: p } = await supabase.from("products_public").select("*").eq("slug", slug).maybeSingle();
    if (!p) return null;
    const [variants, images, reviews, cats, shipping] = await Promise.all([
      supabase.from("product_variants_public").select("id, sku, option_name, option_value, price_bdt, compare_at_price_bdt, available_qty, low_stock_threshold, is_default, position").eq("product_id", p.id!).order("position"),
      supabase.from("product_images").select("id, variant_id, position, url, alt_text_en, manifest, blur_data_url, width, height").eq("product_id", p.id!).order("position"),
      supabase.from("reviews").select("id, rating, title, body, reviewer_name, is_verified_purchase, admin_reply, replied_at, created_at").eq("product_id", p.id!).eq("status", "approved").order("created_at", { ascending: false }).limit(12),
      supabase.from("product_categories").select("category_id").eq("product_id", p.id!),
      getShippingEstimates(),
    ]);
    const allCats = await getNavCategories();
    const category = allCats.find((c) => c.id === (cats.data ?? [])[0]?.category_id) ?? null;

    let related: ProductSummary[] = [];
    if (category) {
      const ids = (await productIdsInCategory(category.id)).filter((id) => id !== p.id);
      if (ids.length) {
        const { data } = await supabase.from("products_public").select(SUMMARY_COLUMNS).in("id", ids).order("review_count", { ascending: false }).limit(8);
        related = (data ?? []).map((r) => toSummary(r as ProductRow));
      }
    }

    const specsRaw = Array.isArray(p.specs) ? (p.specs as { label?: unknown; value?: unknown }[]) : [];
    return {
      product: {
        ...toSummary(p as ProductRow),
        description_en: p.description_en,
        short_description: p.short_description,
        specs: specsRaw.filter((s) => s && typeof s.label === "string").map((s) => ({ label: String(s.label), value: String(s.value ?? "") })),
        highlights: p.highlights ?? [],
        warranty_months: p.warranty_months ?? 0,
        video_url: p.video_url,
        updated_at: p.updated_at ?? new Date().toISOString(),
      },
      variants: (variants.data ?? []) as VariantPublic[],
      images: (images.data ?? [])
        .map((i) => ({ id: i.id, variant_id: i.variant_id, position: i.position, picture: toPicture(i, p.title_en ?? "")! }))
        .filter((i) => i.picture),
      reviews: (reviews.data ?? []) as ReviewPublic[],
      category,
      related,
      shipping,
    };
  },
  ["product-detail"],
  { revalidate: CATALOG_REVALIDATE, tags: ["catalog"] },
);

export async function getAllProductSlugs(): Promise<{ slug: string; updated_at: string }[]> {
  const { data } = await createPublicClient().from("products_public").select("slug, updated_at").order("published_at", { ascending: false, nullsFirst: false });
  return (data ?? []).map((r) => ({ slug: r.slug!, updated_at: r.updated_at ?? new Date().toISOString() }));
}

/** Header search: top matches. */
export async function quickSearch(query: string, limit = 6): Promise<ProductSummary[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const supabase = createPublicClient();
  let res = await supabase.from("products_public").select(SUMMARY_COLUMNS).textSearch("search_vector", q, { type: "websearch", config: "simple" }).limit(limit);
  if (!res.data?.length) res = await supabase.from("products_public").select(SUMMARY_COLUMNS).ilike("title_en", `%${q}%`).limit(limit);
  return (res.data ?? []).map((r) => toSummary(r as ProductRow));
}
