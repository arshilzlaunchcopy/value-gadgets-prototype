"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/admin";
import { scanInternalLinks } from "@/lib/seo/audit";
import { recordSlugRedirect } from "@/lib/seo/redirects";
import { applyTemplate, seoSettingsSchema } from "@/lib/seo/settings";
import { createAdminClient } from "@/lib/supabase/admin";

type R<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };
const fail = (e: unknown): R<never> => ({ ok: false, error: e instanceof Error ? e.message : String(e) });
const uuid = z.string().uuid();

function bust() {
  revalidateTag("seo");
  revalidateTag("catalog");
  revalidateTag("content");
  revalidateTag("pages");
  revalidateTag("settings");
}

export async function saveSeoSettingsAction(raw: unknown): Promise<R> {
  try {
    const s = await requireAdmin("manager");
    const v = seoSettingsSchema.parse(raw);
    const { error } = await createAdminClient().from("settings").upsert({ key: "seo", value: v as never, is_public: true, updated_by: s.userId }, { onConflict: "key" });
    if (error) return { ok: false, error: error.message };
    await audit(s, "settings.seo", { type: "settings", after: { ...v, meta_capi_token: v.meta_capi_token ? "***" : "" } });
    bust();
    revalidatePath("/", "layout");
    return { ok: true, message: "SEO defaults saved" };
  } catch (e) {
    return fail(e);
  }
}

const metaSchema = z.object({
  entity_type: z.enum(["product", "category", "collection", "page", "post", "home"]),
  entity_id: uuid.nullable(),
  locale: z.enum(["en", "bn"]).default("en"),
  meta_title: z.string().trim().max(120).optional().or(z.literal("")),
  meta_description: z.string().trim().max(320).optional().or(z.literal("")),
  og_title: z.string().trim().max(120).optional().or(z.literal("")),
  og_description: z.string().trim().max(320).optional().or(z.literal("")),
  og_image_url: z.string().trim().max(500).optional().or(z.literal("")),
  canonical_url: z.string().trim().max(500).optional().or(z.literal("")),
  robots: z.string().trim().max(40).default("index,follow"),
});

/** Per-entity meta (one row per locale). All fields blank + default robots deletes the row (back to generated). */
export async function saveSeoMetaAction(raw: unknown): Promise<R> {
  try {
    await requireAdmin();
    const m = metaSchema.parse(raw);
    const admin = createAdminClient();
    const empty = !m.meta_title && !m.meta_description && !m.og_title && !m.og_description && !m.og_image_url && !m.canonical_url && m.robots === "index,follow";
    let q = admin.from("seo_meta").delete().eq("entity_type", m.entity_type).eq("locale", m.locale);
    q = m.entity_id ? q.eq("entity_id", m.entity_id) : q.is("entity_id", null);
    if (empty) {
      const { error } = await q;
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await admin.from("seo_meta").upsert({ entity_type: m.entity_type, entity_id: m.entity_id, locale: m.locale, meta_title: m.meta_title || null, meta_description: m.meta_description || null, og_title: m.og_title || null, og_description: m.og_description || null, og_image_url: m.og_image_url || null, canonical_url: m.canonical_url || null, robots: m.robots }, { onConflict: "entity_type,entity_id,locale" });
      if (error) return { ok: false, error: error.message };
    }
    bust();
    revalidatePath("/admin/seo/entities");
    return { ok: true, message: "Meta saved" };
  } catch (e) {
    return fail(e);
  }
}

const bulkSchema = z.object({
  ids: z.array(uuid).min(1).max(500),
  title_template: z.string().max(160).optional().or(z.literal("")),
  description_template: z.string().max(320).optional().or(z.literal("")),
  robots: z.string().max(40).optional().or(z.literal("")),
  only_missing: z.boolean().default(true),
});

/** Bulk-edit product meta from templates: {title} {brand} {price} {category} {store} (§7.10). */
export async function bulkSeoAction(raw: unknown): Promise<R<{ updated: number }>> {
  try {
    await requireAdmin("manager");
    const b = bulkSchema.parse(raw);
    const admin = createAdminClient();
    const [{ data: products }, { data: metas }, { data: storeRow }] = await Promise.all([
      admin.from("products").select("id, title_en, short_description, brands(name), product_variants(price_bdt), product_categories(categories(name_en))").in("id", b.ids),
      admin.from("seo_meta").select("entity_id, meta_title, meta_description, robots").eq("entity_type", "product").eq("locale", "en").in("entity_id", b.ids),
      admin.from("settings").select("value").eq("key", "store").maybeSingle(),
    ]);
    const store = ((storeRow?.value as { name?: string } | null)?.name ?? "Store").trim();
    const existing = new Map((metas ?? []).map((m) => [m.entity_id, m]));
    let updated = 0;
    for (const p of products ?? []) {
      const cur = existing.get(p.id);
      const prices = (p.product_variants ?? []).map((v) => v.price_bdt);
      const vars = { title: p.title_en, brand: (p.brands as { name: string } | null)?.name ?? "", price: prices.length ? `৳${Math.min(...prices).toLocaleString("en-IN")}` : "", category: ((p.product_categories ?? [])[0]?.categories as { name_en: string } | null)?.name_en ?? "", store };
      const row: Record<string, string | null> = {};
      if (b.title_template && (!b.only_missing || !cur?.meta_title)) row.meta_title = applyTemplate(b.title_template, vars).slice(0, 120);
      if (b.description_template && (!b.only_missing || !cur?.meta_description)) row.meta_description = applyTemplate(b.description_template, { ...vars, short_description: p.short_description ?? "" }).slice(0, 320);
      if (b.robots) row.robots = b.robots;
      if (Object.keys(row).length === 0) continue;
      const { error } = await admin.from("seo_meta").upsert({ entity_type: "product", entity_id: p.id, locale: "en", robots: cur?.robots ?? "index,follow", meta_title: cur?.meta_title ?? null, meta_description: cur?.meta_description ?? null, ...row }, { onConflict: "entity_type,entity_id,locale" });
      if (!error) updated++;
    }
    bust();
    revalidatePath("/admin/seo/entities");
    return { ok: true, data: { updated }, message: `${updated} product(s) updated` };
  } catch (e) {
    return fail(e);
  }
}

const redirectSchema = z.object({
  id: uuid.optional(),
  from_path: z.string().trim().min(1).max(500).regex(/^\//, "must start with /"),
  to_path: z.string().trim().min(1).max(500),
  status_code: z.union([z.literal(301), z.literal(302), z.literal(410)]).default(301),
  is_active: z.boolean().default(true),
});

export async function saveRedirectAction(raw: unknown): Promise<R> {
  try {
    await requireAdmin("manager");
    const r = redirectSchema.parse(raw);
    if (r.from_path === r.to_path) return { ok: false, error: "A redirect cannot point at itself" };
    const admin = createAdminClient();
    const row = { from_path: r.from_path.replace(/\/$/, "") || "/", to_path: r.to_path, status_code: r.status_code, is_active: r.is_active };
    const { error } = r.id ? await admin.from("redirects").update(row).eq("id", r.id) : await admin.from("redirects").upsert(row, { onConflict: "from_path" });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/seo/redirects");
    return { ok: true, message: "Redirect saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteRedirectAction(id: string): Promise<R> {
  try {
    await requireAdmin("manager");
    const { error } = await createAdminClient().from("redirects").delete().eq("id", uuid.parse(id));
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/seo/redirects");
    return { ok: true, message: "Deleted" };
  } catch (e) {
    return fail(e);
  }
}

/** CSV import: from_path,to_path[,status_code] per line; header row optional (§7.6). */
export async function importRedirectsCsvAction(csv: string): Promise<R<{ imported: number; skipped: number }>> {
  try {
    await requireAdmin("manager");
    const rows: { from_path: string; to_path: string; status_code: number; is_active: boolean }[] = [];
    let skipped = 0;
    for (const line of csv.split(/\r?\n/)) {
      const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      if (cells.length < 2 || !cells[0].startsWith("/")) { if (line.trim()) skipped++; continue; }
      const code = Number(cells[2] ?? 301);
      rows.push({ from_path: cells[0].replace(/\/$/, "") || "/", to_path: cells[1], status_code: [301, 302, 410].includes(code) ? code : 301, is_active: true });
    }
    if (rows.length === 0) return { ok: false, error: "No rows found. Format: from_path,to_path[,status_code]" };
    const { error } = await createAdminClient().from("redirects").upsert(rows, { onConflict: "from_path" });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/seo/redirects");
    return { ok: true, data: { imported: rows.length, skipped }, message: `${rows.length} imported, ${skipped} skipped` };
  } catch (e) {
    return fail(e);
  }
}

export async function setAltTextAction(imageId: string, alt: string): Promise<R> {
  try {
    await requireAdmin();
    const { error } = await createAdminClient().from("product_images").update({ alt_text_en: z.string().trim().min(3).max(200).parse(alt) }).eq("id", uuid.parse(imageId));
    if (error) return { ok: false, error: error.message };
    revalidateTag("catalog");
    revalidatePath("/admin/seo/alt-text");
    return { ok: true, message: "Alt text saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function scanLinksAction() {
  await requireAdmin();
  return scanInternalLinks();
}

/** Busts the feed caches; the next request regenerates them (§7.7). */
export async function regenerateFeedsAction(): Promise<R> {
  try {
    await requireAdmin();
    revalidatePath("/feeds/google-merchant.xml");
    revalidatePath("/feeds/facebook-catalog.csv");
    revalidatePath("/sitemap.xml");
    return { ok: true, message: "Feeds and sitemap will regenerate on next fetch" };
  } catch (e) {
    return fail(e);
  }
}

// ----------------------------------------------------- categories & collections
const categorySchema = z.object({
  id: uuid,
  name_en: z.string().trim().min(1).max(80),
  name_bn: z.string().trim().max(80).optional().or(z.literal("")),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/),
  description_en: z.string().trim().max(600).optional().or(z.literal("")),
  description_bn: z.string().trim().max(600).optional().or(z.literal("")),
  position: z.number().int().min(0).max(1000),
  is_active: z.boolean(),
  index_filters: z.boolean(),
});

export async function saveCategoryAction(raw: unknown): Promise<R> {
  try {
    await requireAdmin("manager");
    const c = categorySchema.parse(raw);
    const admin = createAdminClient();
    const { data: prev } = await admin.from("categories").select("slug").eq("id", c.id).single();
    const { error } = await admin.from("categories").update({ name_en: c.name_en, name_bn: c.name_bn || null, slug: c.slug, description_en: c.description_en || null, description_bn: c.description_bn || null, position: c.position, is_active: c.is_active, index_filters: c.index_filters }).eq("id", c.id);
    if (error) return { ok: false, error: error.code === "23505" ? "That slug is already used" : error.message };
    if (prev && prev.slug !== c.slug) {
      await recordSlugRedirect("category", prev.slug, c.slug);
      revalidatePath(`/category/${prev.slug}`);
    }
    bust();
    revalidateTag("layout");
    revalidatePath(`/category/${c.slug}`);
    revalidatePath("/admin/catalog");
    return { ok: true, message: "Category saved" };
  } catch (e) {
    return fail(e);
  }
}

const collectionSchema = z.object({
  id: uuid,
  title_en: z.string().trim().min(1).max(80),
  title_bn: z.string().trim().max(80).optional().or(z.literal("")),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/),
  description_en: z.string().trim().max(600).optional().or(z.literal("")),
  position: z.number().int().min(0).max(1000),
  is_active: z.boolean(),
});

export async function saveCollectionAction(raw: unknown): Promise<R> {
  try {
    await requireAdmin("manager");
    const c = collectionSchema.parse(raw);
    const admin = createAdminClient();
    const { data: prev } = await admin.from("collections").select("slug").eq("id", c.id).single();
    const { error } = await admin.from("collections").update({ title_en: c.title_en, title_bn: c.title_bn || null, slug: c.slug, description_en: c.description_en || null, position: c.position, is_active: c.is_active }).eq("id", c.id);
    if (error) return { ok: false, error: error.code === "23505" ? "That slug is already used" : error.message };
    if (prev && prev.slug !== c.slug) {
      await recordSlugRedirect("collection", prev.slug, c.slug);
      revalidatePath(`/collection/${prev.slug}`);
    }
    bust();
    revalidateTag("layout");
    revalidatePath(`/collection/${c.slug}`);
    revalidatePath("/admin/catalog");
    return { ok: true, message: "Collection saved" };
  } catch (e) {
    return fail(e);
  }
}
