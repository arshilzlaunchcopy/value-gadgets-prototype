"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { productSchema } from "@/lib/products/schema";
import { recordSlugRedirect } from "@/lib/seo/redirects";
import { createAdminClient } from "@/lib/supabase/admin";

type R<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };
const uuid = z.string().uuid();
const fail = (e: unknown): R<never> => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

async function revalidateProduct(slug: string | null) {
  revalidateTag("catalog");
  revalidateTag("content");
  revalidatePath("/");
  if (slug) revalidatePath(`/products/${slug}`);
}

// Schemas live in src/lib/products/schema.ts: a "use server" file may only export async functions.

/** Create or update a product with variants, organisation and SEO. Slug changes leave a 301 behind (§7.6). */
export async function saveProductAction(payloadRaw: unknown): Promise<R<{ id: string; slug: string }>> {
  try {
    await requireAdmin();
    const p = productSchema.parse(payloadRaw);
    const admin = createAdminClient();
    if (!p.variants.some((v) => v.is_default)) p.variants[0].is_default = true;

    let oldSlug: string | null = null;
    if (p.id) {
      const { data } = await admin.from("products").select("slug").eq("id", p.id).maybeSingle();
      oldSlug = data?.slug ?? null;
    }
    const row = {
      title_en: p.title_en,
      title_bn: p.title_bn || null,
      slug: p.slug,
      brand_id: p.brand_id ?? null,
      short_description: p.short_description || null,
      description_en: p.description_en || null,
      description_bn: p.description_bn || null,
      specs: p.specs as never,
      highlights: p.highlights,
      status: p.status,
      is_featured: p.is_featured,
      warranty_months: p.warranty_months,
      video_url: p.video_url || null,
      published_at: p.status === "active" ? new Date().toISOString() : null,
    };
    let productId = p.id;
    if (productId) {
      const { error } = await admin.from("products").update({ ...row, published_at: undefined }).eq("id", productId);
      if (error) return { ok: false, error: error.message };
    } else {
      const { data, error } = await admin.from("products").insert(row).select("id").single();
      if (error) return { ok: false, error: error.code === "23505" ? "That slug is already used" : error.message };
      productId = data.id;
    }

    // variants: upsert kept ones, delete removed ones
    const { data: existing } = await admin.from("product_variants").select("id").eq("product_id", productId);
    const keep = new Set(p.variants.map((v) => v.id).filter(Boolean));
    const toDelete = (existing ?? []).map((v) => v.id).filter((id) => !keep.has(id));
    if (toDelete.length) await admin.from("product_variants").delete().in("id", toDelete);
    for (const [i, v] of p.variants.entries()) {
      const vr = { product_id: productId, sku: v.sku, option_name: v.option_name || null, option_value: v.option_value || null, price_bdt: v.price_bdt, compare_at_price_bdt: v.compare_at_price_bdt ?? null, cost_bdt: v.cost_bdt ?? null, stock_qty: v.stock_qty, low_stock_threshold: v.low_stock_threshold, weight_grams: v.weight_grams ?? null, gtin: v.gtin || null, mpn: v.mpn || null, is_default: v.is_default, position: i };
      const res = v.id ? await admin.from("product_variants").update(vr).eq("id", v.id) : await admin.from("product_variants").insert(vr);
      if (res.error) return { ok: false, error: res.error.code === "23505" ? `SKU ${v.sku} is already used` : res.error.message };
    }

    await admin.from("product_categories").delete().eq("product_id", productId);
    if (p.category_ids.length) await admin.from("product_categories").insert(p.category_ids.map((category_id) => ({ product_id: productId!, category_id })));
    await admin.from("collection_products").delete().eq("product_id", productId);
    if (p.collection_ids.length) await admin.from("collection_products").insert(p.collection_ids.map((collection_id, i) => ({ product_id: productId!, collection_id, position: i })));

    if (p.seo) {
      for (const locale of ["en", "bn"] as const) {
        const s = p.seo[locale];
        const empty = !s.meta_title && !s.meta_description && !s.og_image_url;
        if (empty) await admin.from("seo_meta").delete().eq("entity_type", "product").eq("entity_id", productId).eq("locale", locale);
        else await admin.from("seo_meta").upsert({ entity_type: "product", entity_id: productId, locale, meta_title: s.meta_title || null, meta_description: s.meta_description || null, og_image_url: s.og_image_url || null, robots: s.robots || "index,follow" }, { onConflict: "entity_type,entity_id,locale" });
      }
    }

    if (oldSlug && oldSlug !== p.slug) {
      await recordSlugRedirect("product", oldSlug, p.slug);
      revalidatePath(`/products/${oldSlug}`);
    }
    await revalidateProduct(p.slug);
    revalidateTag("seo");
    revalidatePath("/admin/products");
    return { ok: true, data: { id: productId!, slug: p.slug }, message: "Product saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function setVariantStockAction(variantId: string, qty: number, reason = "correction"): Promise<R> {
  try {
    const s = await requireAdmin();
    const id = uuid.parse(variantId);
    const target = z.number().int().min(0).parse(qty);
    const admin = createAdminClient();
    const { data: v } = await admin.from("product_variants").select("stock_qty, products(slug)").eq("id", id).single();
    if (!v) return { ok: false, error: "Variant not found" };
    const delta = target - v.stock_qty;
    if (delta !== 0) {
      const { error } = await admin.rpc("adjust_stock", { p_variant: id, p_delta: delta, p_reason: reason, p_actor: s.userId, p_note: "inline edit" });
      if (error) return { ok: false, error: error.message };
    }
    await revalidateProduct((v.products as { slug: string } | null)?.slug ?? null);
    return { ok: true, message: `Stock set to ${target}` };
  } catch (e) {
    return fail(e);
  }
}

export async function bulkProductStatusAction(ids: string[], status: "draft" | "active" | "archived"): Promise<R> {
  try {
    await requireAdmin("manager");
    const list = z.array(uuid).min(1).max(200).parse(ids);
    const admin = createAdminClient();
    const { error } = await admin.from("products").update({ status, ...(status === "active" ? { published_at: new Date().toISOString() } : {}) }).in("id", list);
    if (error) return { ok: false, error: error.message };
    await revalidateProduct(null);
    revalidatePath("/admin/products");
    return { ok: true, message: `${list.length} product(s) set to ${status}` };
  } catch (e) {
    return fail(e);
  }
}

export async function duplicateProductAction(id: string): Promise<R<{ id: string }>> {
  try {
    await requireAdmin();
    const src = uuid.parse(id);
    const admin = createAdminClient();
    const { data: p } = await admin.from("products").select("*, product_variants(*), product_categories(category_id), product_images(*)").eq("id", src).single();
    if (!p) return { ok: false, error: "Product not found" };
    const tag = Math.random().toString(36).slice(2, 6);
    const { data: np, error } = await admin.from("products").insert({ title_en: `${p.title_en} (copy)`, title_bn: p.title_bn, slug: `${p.slug}-copy-${tag}`, brand_id: p.brand_id, short_description: p.short_description, description_en: p.description_en, description_bn: p.description_bn, specs: p.specs, highlights: p.highlights, status: "draft", is_featured: false, warranty_months: p.warranty_months, video_url: p.video_url }).select("id").single();
    if (error) return { ok: false, error: error.message };
    await admin.from("product_variants").insert((p.product_variants ?? []).map((v) => ({ product_id: np.id, sku: `${v.sku}-${tag.toUpperCase()}`, option_name: v.option_name, option_value: v.option_value, price_bdt: v.price_bdt, compare_at_price_bdt: v.compare_at_price_bdt, cost_bdt: v.cost_bdt, stock_qty: 0, low_stock_threshold: v.low_stock_threshold, weight_grams: v.weight_grams, is_default: v.is_default, position: v.position })));
    if (p.product_categories?.length) await admin.from("product_categories").insert(p.product_categories.map((c) => ({ product_id: np.id, category_id: c.category_id })));
    if (p.product_images?.length) await admin.from("product_images").insert(p.product_images.map((img) => ({ product_id: np.id, url: img.url, alt_text_en: img.alt_text_en, alt_text_bn: img.alt_text_bn, width: img.width, height: img.height, position: img.position, blur_data_url: img.blur_data_url, manifest: img.manifest, content_hash: img.content_hash, format: img.format, bytes: img.bytes })));
    revalidatePath("/admin/products");
    return { ok: true, data: { id: np.id }, message: "Duplicated as a draft" };
  } catch (e) {
    return fail(e);
  }
}

export async function saveProductImagesAction(productId: string, images: { id: string; alt_text_en: string; alt_text_bn?: string; variant_id?: string | null }[]): Promise<R> {
  try {
    await requireAdmin();
    const pid = uuid.parse(productId);
    const list = z.array(z.object({ id: uuid, alt_text_en: z.string().trim().min(1).max(200), alt_text_bn: z.string().max(200).optional(), variant_id: uuid.nullable().optional() })).max(30).parse(images);
    const admin = createAdminClient();
    const { data: existing } = await admin.from("product_images").select("id").eq("product_id", pid);
    const keep = new Set(list.map((i) => i.id));
    const toDelete = (existing ?? []).map((i) => i.id).filter((id) => !keep.has(id));
    if (toDelete.length) await admin.from("product_images").delete().in("id", toDelete);
    for (const [i, img] of list.entries()) await admin.from("product_images").update({ position: i, alt_text_en: img.alt_text_en, alt_text_bn: img.alt_text_bn || null, variant_id: img.variant_id ?? null }).eq("id", img.id).eq("product_id", pid);
    const { data: p } = await admin.from("products").select("slug").eq("id", pid).single();
    await revalidateProduct(p?.slug ?? null);
    return { ok: true, message: "Images saved" };
  } catch (e) {
    return fail(e);
  }
}
