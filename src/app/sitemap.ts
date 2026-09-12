import type { MetadataRoute } from "next";
import { getAllCollections, getAllProductSlugs, getNavCategories } from "@/lib/catalog/queries";
import { publicEnv } from "@/lib/env.public";

export const revalidate = 3600;

/** Minimal sitemap; the chunked sitemap index (BUILD_PROMPT §7.4) lands in Phase 14. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.siteUrl.replace(/\/$/, "");
  const [products, categories, collections] = await Promise.all([getAllProductSlugs(), getNavCategories(), getAllCollections()]);
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    ...categories.map((c) => ({ url: `${base}/category/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...collections.map((c) => ({ url: `${base}/collection/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...products.map((p) => ({ url: `${base}/products/${p.slug}`, lastModified: p.updated_at, changeFrequency: "weekly" as const, priority: 0.9 })),
    ...["terms", "privacy", "refund"].map((s) => ({ url: `${base}/policies/${s}`, changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
