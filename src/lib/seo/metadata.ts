import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { publicEnv } from "@/lib/env.public";
import { truncate } from "@/lib/format";
import { getStoreSettings } from "@/lib/settings";
import { createPublicClient } from "@/lib/supabase/public";
import { applyTemplate, getSeoSettings, SEO_TAG } from "./settings";

export type SeoEntityType = "product" | "category" | "collection" | "page" | "post" | "home";
export type Locale = "en" | "bn";

export interface SeoMetaRow {
  meta_title: string | null;
  meta_description: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image_url: string | null;
  canonical_url: string | null;
  robots: string;
  schema_override: unknown;
}

/** Explicit seo_meta row for an entity + locale (null entity id = home). Cached under the seo tag. */
export const getSeoMeta = unstable_cache(
  async (entityType: SeoEntityType, entityId: string | null, locale: Locale): Promise<SeoMetaRow | null> => {
    let q = createPublicClient().from("seo_meta").select("meta_title, meta_description, og_title, og_description, og_image_url, canonical_url, robots, schema_override").eq("entity_type", entityType).eq("locale", locale);
    q = entityId ? q.eq("entity_id", entityId) : q.is("entity_id", null);
    const { data } = await q.maybeSingle();
    return (data as SeoMetaRow | null) ?? null;
  },
  ["seo-meta"],
  { revalidate: 3600, tags: [SEO_TAG] },
);

export interface BuildMetadataInput {
  entityType: SeoEntityType;
  entityId: string | null;
  locale?: Locale;
  /** canonical path, e.g. /products/slug */
  path: string;
  /** values for the title template: title | name */
  templateVars: Record<string, string>;
  /** generated description when seo_meta has none */
  fallbackDescription?: string | null;
  image?: { url: string; width?: number; height?: number; alt?: string } | null;
  /** override robots (e.g. filtered listings) */
  noindex?: boolean;
  ogType?: "website" | "article" | "product";
  publishedTime?: string | null;
  modifiedTime?: string | null;
}

/**
 * Fallback chain (BUILD_PROMPT §7.2): explicit seo_meta -> template -> site default.
 * Description auto-generates from the entity text truncated at 155 characters.
 * Self-referencing canonical on every page (§7.5).
 */
export async function buildMetadata(i: BuildMetadataInput): Promise<Metadata> {
  const locale = i.locale ?? "en";
  const [seo, store, meta] = await Promise.all([getSeoSettings(), getStoreSettings(), getSeoMeta(i.entityType, i.entityId, locale)]);
  const vars = { store: store.name, ...i.templateVars };
  const template = { product: seo.title_template_product, category: seo.title_template_category, collection: seo.title_template_collection, post: seo.title_template_post, page: seo.title_template_page, home: "" }[i.entityType];
  const generatedTitle = i.entityType === "home" ? seo.home_title || `${store.name} - ${store.tagline}` : applyTemplate(template, vars);
  const title = meta?.meta_title?.trim() || generatedTitle;
  const description = meta?.meta_description?.trim() || (i.fallbackDescription ? truncate(i.fallbackDescription.replace(/\s+/g, " ").trim(), 155) : "") || seo.default_description || store.tagline;
  const canonical = meta?.canonical_url?.trim() || i.path;
  const robotsStr = (meta?.robots ?? "index,follow").toLowerCase();
  const noindex = i.noindex || !seo.index_site || robotsStr.includes("noindex");
  const nofollow = robotsStr.includes("nofollow");
  const ogImage = meta?.og_image_url?.trim() || i.image?.url || seo.default_og_image || undefined;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: { index: !noindex, follow: !nofollow, googleBot: { index: !noindex, follow: !nofollow, "max-image-preview": "large", "max-snippet": -1 } },
    openGraph: {
      title: meta?.og_title?.trim() || title,
      description: meta?.og_description?.trim() || description,
      url: canonical,
      siteName: store.name,
      type: i.ogType === "product" ? "website" : (i.ogType ?? "website"),
      locale: locale === "bn" ? "bn_BD" : "en_BD",
      images: ogImage ? [{ url: ogImage, width: i.image?.width, height: i.image?.height, alt: i.image?.alt ?? title }] : undefined,
      ...(i.ogType === "article" ? { publishedTime: i.publishedTime ?? undefined, modifiedTime: i.modifiedTime ?? undefined } : {}),
    },
    twitter: { card: ogImage ? "summary_large_image" : "summary", title, description },
  };
}

export function absoluteUrl(path: string): string {
  return new URL(path, publicEnv.siteUrl).toString();
}
