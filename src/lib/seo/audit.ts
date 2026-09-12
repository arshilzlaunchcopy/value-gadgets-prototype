import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { applyTemplate, getSeoSettings } from "./settings";

/**
 * SEO Center data (BUILD_PROMPT §7.10): every indexable entity with its
 * effective title/description, whether they are explicit or generated, and a
 * completeness score; the missing alt-text report; the broken-link scan.
 */
export type SeoEntityKind = "product" | "category" | "collection" | "page" | "post";

export interface SeoEntityRow {
  kind: SeoEntityKind;
  id: string;
  label: string;
  path: string;
  title: string;
  titleSource: "explicit" | "generated";
  description: string;
  descriptionSource: "explicit" | "generated" | "missing";
  robots: string;
  hasOgImage: boolean;
  hasImage: boolean;
  /** 0-100 */
  score: number;
  issues: string[];
}

/** Google shows ~60 characters of a title and ~155 of a description before truncating. */
export function scoreEntity(e: Omit<SeoEntityRow, "score" | "issues">): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;
  if (!e.title) { score -= 40; issues.push("No title"); }
  else if (e.title.length > 65) { score -= 10; issues.push("Title over 65 characters (truncated in results)"); }
  else if (e.title.length < 25) { score -= 5; issues.push("Title under 25 characters"); }
  if (e.descriptionSource === "missing") { score -= 30; issues.push("No description"); }
  else if (e.description.length > 160) { score -= 10; issues.push("Description over 160 characters"); }
  else if (e.description.length < 70) { score -= 10; issues.push("Description under 70 characters"); }
  if (e.titleSource === "generated" && e.descriptionSource !== "explicit") { score -= 5; issues.push("Using generated meta"); }
  if (!e.hasImage && !e.hasOgImage) { score -= 15; issues.push("No share image"); }
  if (/noindex/.test(e.robots)) issues.push("noindex");
  return { score: Math.max(0, score), issues };
}

export async function listSeoEntities(kind?: SeoEntityKind): Promise<SeoEntityRow[]> {
  const admin = createAdminClient();
  const [seo, { data: metas }] = await Promise.all([getSeoSettings(), admin.from("seo_meta").select("entity_type, entity_id, meta_title, meta_description, og_image_url, robots").eq("locale", "en")]);
  const { data: storeRow } = await admin.from("settings").select("value").eq("key", "store").maybeSingle();
  const store = ((storeRow?.value as { name?: string } | null)?.name ?? "Store").trim();
  const meta = new Map((metas ?? []).map((m) => [`${m.entity_type}:${m.entity_id}`, m]));
  const rows: SeoEntityRow[] = [];
  const push = (base: Omit<SeoEntityRow, "score" | "issues" | "title" | "titleSource" | "description" | "descriptionSource" | "robots" | "hasOgImage">, generatedTitle: string, generatedDescription: string | null) => {
    const m = meta.get(`${base.kind}:${base.id}`);
    const title = m?.meta_title?.trim() || generatedTitle;
    const description = m?.meta_description?.trim() || (generatedDescription ?? "").replace(/\s+/g, " ").trim().slice(0, 155);
    const partial = { ...base, title, titleSource: (m?.meta_title ? "explicit" : "generated") as "explicit" | "generated", description, descriptionSource: (m?.meta_description ? "explicit" : description ? "generated" : "missing") as SeoEntityRow["descriptionSource"], robots: m?.robots ?? "index,follow", hasOgImage: Boolean(m?.og_image_url) };
    rows.push({ ...partial, ...scoreEntity(partial) });
  };

  if (!kind || kind === "product") {
    const { data } = await admin.from("products").select("id, slug, title_en, short_description, description_en, status, product_images(id)").neq("status", "archived").order("title_en").limit(2000);
    for (const p of data ?? []) push({ kind: "product", id: p.id, label: p.title_en, path: `/products/${p.slug}`, hasImage: (p.product_images ?? []).length > 0 }, applyTemplate(seo.title_template_product, { title: p.title_en, store }), p.short_description ?? p.description_en);
  }
  if (!kind || kind === "category") {
    const { data } = await admin.from("categories").select("id, slug, name_en, description_en, image_url").eq("is_active", true).order("position");
    for (const c of data ?? []) push({ kind: "category", id: c.id, label: c.name_en, path: `/category/${c.slug}`, hasImage: Boolean(c.image_url) }, applyTemplate(seo.title_template_category, { name: c.name_en, title: c.name_en, store }), c.description_en);
  }
  if (!kind || kind === "collection") {
    const { data } = await admin.from("collections").select("id, slug, title_en, description_en, image_url").eq("is_active", true).order("position");
    for (const c of data ?? []) push({ kind: "collection", id: c.id, label: c.title_en, path: `/collection/${c.slug}`, hasImage: Boolean(c.image_url) }, applyTemplate(seo.title_template_collection, { name: c.title_en, title: c.title_en, store }), c.description_en);
  }
  if (!kind || kind === "page") {
    const { data } = await admin.from("pages").select("id, slug, title_en, content_en").eq("is_published", true).order("position");
    for (const p of data ?? []) push({ kind: "page", id: p.id, label: p.title_en, path: `/pages/${p.slug}`, hasImage: false }, applyTemplate(seo.title_template_page, { title: p.title_en, store }), (p.content_en ?? "").replace(/[#*_>`-]/g, " "));
  }
  if (!kind || kind === "post") {
    const { data } = await admin.from("posts").select("id, slug, title_en, excerpt_en, cover_image_url").eq("status", "published").order("published_at", { ascending: false });
    for (const p of data ?? []) push({ kind: "post", id: p.id, label: p.title_en, path: `/blog/${p.slug}`, hasImage: Boolean(p.cover_image_url) }, applyTemplate(seo.title_template_post, { title: p.title_en, store }), p.excerpt_en);
  }
  return rows;
}

export interface AltTextIssue {
  image_id: string;
  product_id: string;
  product_title: string;
  slug: string;
  url: string;
  alt_text_en: string;
  problem: "missing" | "too short" | "generic";
}

/** Missing / weak alt text on product images (§7.10). */
export async function altTextReport(): Promise<AltTextIssue[]> {
  const { data } = await createAdminClient().from("product_images").select("id, product_id, url, alt_text_en, products(title_en, slug, status)").limit(5000);
  const out: AltTextIssue[] = [];
  for (const i of data ?? []) {
    const p = i.products as { title_en: string; slug: string; status: string } | null;
    if (!p || p.status === "archived") continue;
    const alt = (i.alt_text_en ?? "").trim();
    let problem: AltTextIssue["problem"] | null = null;
    if (!alt) problem = "missing";
    else if (alt.length < 8) problem = "too short";
    else if (/^(image|photo|picture|img|untitled|product)(\s*\d*)?$/i.test(alt)) problem = "generic";
    if (problem) out.push({ image_id: i.id, product_id: i.product_id, product_title: p.title_en, slug: p.slug, url: i.url, alt_text_en: alt, problem });
  }
  return out;
}

export interface BrokenLink {
  source: string;
  href: string;
  reason: string;
}

const STATIC_ROUTES = new Set(["/", "/search", "/cart", "/checkout", "/account", "/track", "/blog", "/demo"]);

function collectHrefs(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    if (value.startsWith("/") && !value.startsWith("//")) out.push(value);
    // markdown links
    for (const m of value.matchAll(/\]\((\/[^)\s]+)\)/g)) out.push(m[1]);
  } else if (Array.isArray(value)) value.forEach((v) => collectHrefs(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectHrefs(v, out));
}

/** Broken internal link scanner (§7.10): every internal href in blocks, menus, pages, posts and landing pages must resolve. */
export async function scanInternalLinks(): Promise<{ checked: number; broken: BrokenLink[] }> {
  const admin = createAdminClient();
  const [blocks, nav, pages, posts, landing, products, categories, collections] = await Promise.all([
    admin.from("content_blocks").select("id, page_type, block_type, settings"),
    admin.from("navigation_items").select("id, label_en, link_type, link_target, mega_layout"),
    admin.from("pages").select("slug, title_en, content_en, content_bn"),
    admin.from("posts").select("slug, title_en, content_en, content_bn"),
    admin.from("landing_pages").select("slug"),
    admin.from("products").select("slug, status"),
    admin.from("categories").select("slug, is_active"),
    admin.from("collections").select("slug, is_active"),
  ]);
  const valid = new Set<string>(STATIC_ROUTES);
  for (const p of products.data ?? []) if (p.status === "active") valid.add(`/products/${p.slug}`);
  for (const c of categories.data ?? []) if (c.is_active) valid.add(`/category/${c.slug}`);
  for (const c of collections.data ?? []) if (c.is_active) valid.add(`/collection/${c.slug}`);
  for (const p of pages.data ?? []) valid.add(`/pages/${p.slug}`);
  for (const p of posts.data ?? []) valid.add(`/blog/${p.slug}`);
  for (const l of landing.data ?? []) valid.add(`/lp/${l.slug}`);
  const { data: redirects } = await admin.from("redirects").select("from_path").eq("is_active", true);
  const redirected = new Set((redirects ?? []).map((r) => r.from_path));

  const sources: { source: string; hrefs: string[] }[] = [];
  for (const b of blocks.data ?? []) {
    const hrefs: string[] = [];
    collectHrefs(b.settings, hrefs);
    sources.push({ source: `block ${b.block_type} on ${b.page_type}`, hrefs });
  }
  for (const n of nav.data ?? []) {
    const hrefs: string[] = [];
    if (n.link_type === "url") collectHrefs(n.link_target, hrefs);
    else if (n.link_type === "category") hrefs.push(`/category/${n.link_target}`);
    else if (n.link_type === "collection") hrefs.push(`/collection/${n.link_target}`);
    else if (n.link_type === "product") hrefs.push(`/products/${n.link_target}`);
    else if (n.link_type === "page") hrefs.push(`/pages/${n.link_target}`);
    else if (n.link_type === "post") hrefs.push(`/blog/${n.link_target}`);
    collectHrefs(n.mega_layout, hrefs);
    sources.push({ source: `menu item "${n.label_en}"`, hrefs });
  }
  for (const p of pages.data ?? []) {
    const hrefs: string[] = [];
    collectHrefs([p.content_en, p.content_bn], hrefs);
    sources.push({ source: `page "${p.title_en}"`, hrefs });
  }
  for (const p of posts.data ?? []) {
    const hrefs: string[] = [];
    collectHrefs([p.content_en, p.content_bn], hrefs);
    sources.push({ source: `post "${p.title_en}"`, hrefs });
  }

  const broken: BrokenLink[] = [];
  let checked = 0;
  for (const s of sources) {
    for (const raw of s.hrefs) {
      const href = raw.split("?")[0].split("#")[0].replace(/\/$/, "") || "/";
      if (href.startsWith("/api") || href.startsWith("/_next") || href.startsWith("/admin")) continue;
      checked++;
      if (valid.has(href)) continue;
      if (/^\/(products|category|collection|pages|blog|lp)\//.test(href)) broken.push({ source: s.source, href: raw, reason: redirected.has(href) ? "target moved (redirect exists)" : "target does not exist" });
      else if (!/^\/(search|cart|checkout|account|track|blog|demo|pages)(\/|$)/.test(href) && href !== "/") broken.push({ source: s.source, href: raw, reason: "unknown route" });
    }
  }
  return { checked, broken };
}
