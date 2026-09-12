import "server-only";

import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProductPayload } from "./actions";

export interface EditorImage {
  id: string;
  url: string;
  alt_text_en: string;
  alt_text_bn: string | null;
  variant_id: string | null;
  width: number | null;
  height: number | null;
}

export interface EditorData {
  product: ProductPayload;
  images: EditorImage[];
  brands: { id: string; name: string }[];
  categories: { id: string; name_en: string }[];
  collections: { id: string; title_en: string }[];
  isNew: boolean;
}

const emptySeo = { meta_title: "", meta_description: "", og_image_url: "", robots: "index,follow" };

export async function loadEditor(id: string | null): Promise<EditorData> {
  const admin = createAdminClient();
  const [brands, categories, collections] = await Promise.all([
    admin.from("brands").select("id, name").order("name"),
    admin.from("categories").select("id, name_en").order("position"),
    admin.from("collections").select("id, title_en").order("position"),
  ]);
  const lookups = { brands: brands.data ?? [], categories: categories.data ?? [], collections: collections.data ?? [] };

  if (!id) {
    return {
      isNew: true,
      images: [],
      ...lookups,
      product: { title_en: "", title_bn: "", slug: "", brand_id: null, short_description: "", description_en: "", description_bn: "", specs: [], highlights: [], status: "draft", is_featured: false, warranty_months: 0, video_url: "", variants: [{ sku: "", option_name: "", option_value: "", price_bdt: 0, compare_at_price_bdt: null, cost_bdt: null, stock_qty: 0, low_stock_threshold: 5, weight_grams: null, is_default: true }], category_ids: [], collection_ids: [], seo: { en: { ...emptySeo }, bn: { ...emptySeo } } },
    };
  }

  const { data: p } = await admin.from("products").select("*, product_variants(*), product_categories(category_id), collection_products(collection_id), product_images(id, url, alt_text_en, alt_text_bn, variant_id, width, height, position)").eq("id", id).maybeSingle();
  if (!p) notFound();
  const { data: seo } = await admin.from("seo_meta").select("locale, meta_title, meta_description, og_image_url, robots").eq("entity_type", "product").eq("entity_id", id);
  const seoFor = (locale: "en" | "bn") => {
    const s = (seo ?? []).find((x) => x.locale === locale);
    return s ? { meta_title: s.meta_title ?? "", meta_description: s.meta_description ?? "", og_image_url: s.og_image_url ?? "", robots: s.robots ?? "index,follow" } : { ...emptySeo };
  };
  const specs = Array.isArray(p.specs) ? (p.specs as { label?: string; value?: string }[]).map((s) => ({ label: String(s.label ?? ""), value: String(s.value ?? "") })) : [];
  return {
    isNew: false,
    ...lookups,
    images: [...(p.product_images ?? [])].sort((a, b) => a.position - b.position).map((i) => ({ id: i.id, url: i.url, alt_text_en: i.alt_text_en, alt_text_bn: i.alt_text_bn, variant_id: i.variant_id, width: i.width, height: i.height })),
    product: {
      id: p.id,
      title_en: p.title_en,
      title_bn: p.title_bn ?? "",
      slug: p.slug,
      brand_id: p.brand_id,
      short_description: p.short_description ?? "",
      description_en: p.description_en ?? "",
      description_bn: p.description_bn ?? "",
      specs,
      highlights: p.highlights ?? [],
      status: p.status as "draft" | "active" | "archived",
      is_featured: p.is_featured,
      warranty_months: p.warranty_months,
      video_url: p.video_url ?? "",
      variants: [...(p.product_variants ?? [])].sort((a, b) => a.position - b.position).map((v) => ({ id: v.id, sku: v.sku, option_name: v.option_name ?? "", option_value: v.option_value ?? "", price_bdt: v.price_bdt, compare_at_price_bdt: v.compare_at_price_bdt, cost_bdt: v.cost_bdt, stock_qty: v.stock_qty, low_stock_threshold: v.low_stock_threshold, weight_grams: v.weight_grams, is_default: v.is_default })),
      category_ids: (p.product_categories ?? []).map((c) => c.category_id),
      collection_ids: (p.collection_products ?? []).map((c) => c.collection_id),
      seo: { en: seoFor("en"), bn: seoFor("bn") },
    },
  };
}
