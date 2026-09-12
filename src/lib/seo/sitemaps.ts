import "server-only";

import { getAllCollections, getNavCategories } from "@/lib/catalog/queries";
import { getPublishedLandingSlugs } from "@/lib/landing/queries";
import { createPublicClient } from "@/lib/supabase/public";
import { absoluteUrl } from "./metadata";

export const SITEMAP_CHUNK = 5000;
export const SITEMAP_NAMES = ["products", "categories", "collections", "posts", "pages"] as const;
export type SitemapName = (typeof SITEMAP_NAMES)[number];

interface Entry {
  loc: string;
  lastmod?: string | null;
  changefreq?: string;
  priority?: number;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function urlset(entries: Entry[]): string {
  const body = entries
    .map((e) => `<url><loc>${esc(e.loc)}</loc>${e.lastmod ? `<lastmod>${new Date(e.lastmod).toISOString()}</lastmod>` : ""}${e.changefreq ? `<changefreq>${e.changefreq}</changefreq>` : ""}${e.priority !== undefined ? `<priority>${e.priority.toFixed(1)}</priority>` : ""}</url>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

/** Entity ids marked noindex in seo_meta are excluded (§7.4). */
async function noindexIds(entityType: string): Promise<Set<string>> {
  const { data } = await createPublicClient().from("seo_meta").select("entity_id, robots").eq("entity_type", entityType).ilike("robots", "%noindex%");
  return new Set((data ?? []).map((r) => r.entity_id).filter((x): x is string => Boolean(x)));
}

async function productEntries(): Promise<Entry[]> {
  const supabase = createPublicClient();
  // active products only (the view filters), in stock (§7.4 excludes out of stock + archived)
  const { data } = await supabase.from("products_public").select("id, slug, updated_at, in_stock").order("published_at", { ascending: false, nullsFirst: false });
  const skip = await noindexIds("product");
  return (data ?? []).filter((p) => p.in_stock && !skip.has(p.id!)).map((p) => ({ loc: absoluteUrl(`/products/${p.slug}`), lastmod: p.updated_at, changefreq: "weekly", priority: 0.9 }));
}

async function categoryEntries(): Promise<Entry[]> {
  const skip = await noindexIds("category");
  const { data } = await createPublicClient().from("categories").select("id, slug, updated_at").eq("is_active", true);
  return (data ?? []).filter((c) => !skip.has(c.id)).map((c) => ({ loc: absoluteUrl(`/category/${c.slug}`), lastmod: c.updated_at, changefreq: "weekly", priority: 0.8 }));
}

async function collectionEntries(): Promise<Entry[]> {
  const skip = await noindexIds("collection");
  const { data } = await createPublicClient().from("collections").select("id, slug, updated_at").eq("is_active", true);
  return (data ?? []).filter((c) => !skip.has(c.id)).map((c) => ({ loc: absoluteUrl(`/collection/${c.slug}`), lastmod: c.updated_at, changefreq: "weekly", priority: 0.7 }));
}

async function postEntries(): Promise<Entry[]> {
  const skip = await noindexIds("post");
  const { data } = await createPublicClient().from("posts").select("id, slug, updated_at, published_at").eq("status", "published");
  return [{ loc: absoluteUrl("/blog"), changefreq: "weekly", priority: 0.5 }, ...(data ?? []).filter((p) => !skip.has(p.id)).map((p) => ({ loc: absoluteUrl(`/blog/${p.slug}`), lastmod: p.updated_at, changefreq: "monthly", priority: 0.6 }))];
}

async function pageEntries(): Promise<Entry[]> {
  const skip = await noindexIds("page");
  const [{ data }, landing] = await Promise.all([createPublicClient().from("pages").select("id, slug, updated_at").eq("is_published", true), getPublishedLandingSlugs()]);
  return [
    { loc: absoluteUrl("/"), changefreq: "daily", priority: 1 },
    ...(data ?? []).filter((p) => !skip.has(p.id)).map((p) => ({ loc: absoluteUrl(`/pages/${p.slug}`), lastmod: p.updated_at, changefreq: "yearly", priority: 0.3 })),
    ...landing.map((l) => ({ loc: absoluteUrl(`/lp/${l.slug}`), lastmod: l.updated_at, changefreq: "weekly", priority: 0.6 })),
  ];
}

const LOADERS: Record<SitemapName, () => Promise<Entry[]>> = { products: productEntries, categories: categoryEntries, collections: collectionEntries, posts: postEntries, pages: pageEntries };

/** One named sitemap (chunk 1 = /sitemap-{name}.xml, chunk n = /sitemaps/{name}-{n}.xml). */
export async function sitemapXml(name: SitemapName, chunk = 1): Promise<{ xml: string; found: boolean }> {
  const entries = await LOADERS[name]();
  const start = (chunk - 1) * SITEMAP_CHUNK;
  const slice = entries.slice(start, start + SITEMAP_CHUNK);
  return { xml: urlset(slice), found: chunk === 1 || slice.length > 0 };
}

/** Sitemap index listing every named sitemap and its extra chunks (§7.4). */
export async function sitemapIndexXml(): Promise<string> {
  const now = new Date().toISOString();
  const parts: string[] = [];
  for (const name of SITEMAP_NAMES) {
    const count = (await LOADERS[name]()).length;
    const chunks = Math.max(1, Math.ceil(count / SITEMAP_CHUNK));
    parts.push(`<sitemap><loc>${esc(absoluteUrl(`/sitemap-${name}.xml`))}</loc><lastmod>${now}</lastmod></sitemap>`);
    for (let c = 2; c <= chunks; c++) parts.push(`<sitemap><loc>${esc(absoluteUrl(`/sitemaps/${name}-${c}.xml`))}</loc><lastmod>${now}</lastmod></sitemap>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${parts.join("")}</sitemapindex>`;
}

export const XML_HEADERS = { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" };

export { getAllCollections, getNavCategories };
