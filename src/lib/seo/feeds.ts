import "server-only";

import { parseManifest } from "@/lib/media/types";
import { getStoreSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { absoluteUrl } from "./metadata";

/**
 * Product feeds (BUILD_PROMPT §7.7): Google Shopping RSS 2.0 with the g: namespace
 * and the Meta commerce catalog CSV. One row per variant (item_group_id = product).
 */
export interface FeedItem {
  id: string; // variant id
  item_group_id: string;
  title: string;
  description: string;
  link: string;
  image_link: string | null;
  additional_images: string[];
  availability: "in stock" | "out of stock";
  price_bdt: number;
  sale_price_bdt: number | null;
  brand: string | null;
  gtin: string | null;
  mpn: string | null;
  sku: string;
  condition: "new";
  product_type: string | null;
  google_category: string;
  shipping_bdt: number;
  variant_label: string | null;
}

export async function loadFeedItems(): Promise<FeedItem[]> {
  const supabase = createPublicClient();
  const [{ data: products }, { data: variants }, { data: images }, { data: pc }, { data: cats }, { data: zones }, { data: skip }] = await Promise.all([
    supabase.from("products_public").select("id, slug, title_en, short_description, description_en, brand_name, primary_image_url, primary_image_manifest"),
    supabase.from("product_variants_public").select("id, product_id, sku, option_name, option_value, price_bdt, compare_at_price_bdt, available_qty, gtin, mpn, position"),
    supabase.from("product_images").select("product_id, url, position"),
    supabase.from("product_categories").select("product_id, category_id"),
    supabase.from("categories").select("id, name_en, parent_id"),
    supabase.from("shipping_zones").select("districts, shipping_rates(rate_bdt, position)").eq("is_active", true),
    supabase.from("seo_meta").select("entity_id").eq("entity_type", "product").ilike("robots", "%noindex%"),
  ]);
  const noindex = new Set((skip ?? []).map((r) => r.entity_id));
  const catName = new Map((cats ?? []).map((c) => [c.id, c]));
  const firstCat = new Map<string, string>();
  for (const r of pc ?? []) if (!firstCat.has(r.product_id)) firstCat.set(r.product_id, r.category_id);
  const imgs = new Map<string, string[]>();
  for (const i of [...(images ?? [])].sort((a, b) => a.position - b.position)) imgs.set(i.product_id, [...(imgs.get(i.product_id) ?? []), i.url]);
  // Dhaka city rate is the feed's shipping figure (Google wants a single amount per item)
  const dhaka = (zones ?? []).find((z) => (z.districts ?? []).some((d) => d.toLowerCase() === "dhaka"));
  const rates = ((dhaka?.shipping_rates ?? []) as { rate_bdt: number; position: number }[]).sort((a, b) => a.position - b.position);
  const shipping = rates[0]?.rate_bdt ?? 60;

  const items: FeedItem[] = [];
  for (const p of products ?? []) {
    if (!p.id || noindex.has(p.id)) continue;
    const manifest = parseManifest(p.primary_image_manifest);
    const primary = manifest?.formats.jpeg.url ?? p.primary_image_url ?? null;
    const all = imgs.get(p.id) ?? [];
    const cat = firstCat.get(p.id) ? catName.get(firstCat.get(p.id)!) : undefined;
    const parent = cat?.parent_id ? catName.get(cat.parent_id) : undefined;
    const productType = cat ? [parent?.name_en, cat.name_en].filter(Boolean).join(" > ") : null;
    for (const v of (variants ?? []).filter((v) => v.product_id === p.id).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))) {
      const onSale = v.compare_at_price_bdt !== null && v.compare_at_price_bdt! > v.price_bdt!;
      items.push({
        id: v.id!,
        item_group_id: p.id,
        title: [p.title_en, v.option_value].filter(Boolean).join(" - ").slice(0, 150),
        description: (p.short_description ?? p.description_en ?? p.title_en ?? "").replace(/\s+/g, " ").slice(0, 5000),
        link: absoluteUrl(`/products/${p.slug}${v.option_value ? `?variant=${v.id}` : ""}`),
        image_link: primary,
        additional_images: all.filter((u) => u !== primary).slice(0, 10),
        availability: (v.available_qty ?? 0) > 0 ? "in stock" : "out of stock",
        price_bdt: onSale ? v.compare_at_price_bdt! : v.price_bdt!,
        sale_price_bdt: onSale ? v.price_bdt! : null,
        brand: p.brand_name,
        gtin: v.gtin ?? null,
        mpn: v.mpn ?? (v.gtin ? null : v.sku),
        sku: v.sku!,
        condition: "new",
        product_type: productType,
        google_category: "Electronics > Electronics Accessories",
        shipping_bdt: shipping,
        variant_label: v.option_value,
      });
    }
  }
  return items;
}

const x = (s: string | null | undefined) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function googleMerchantXml(): Promise<string> {
  const [items, store] = await Promise.all([loadFeedItems(), getStoreSettings()]);
  const entries = items
    .map(
      (i) => `<item>
<g:id>${x(i.id)}</g:id>
<g:item_group_id>${x(i.item_group_id)}</g:item_group_id>
<g:title>${x(i.title)}</g:title>
<g:description>${x(i.description)}</g:description>
<g:link>${x(i.link)}</g:link>
${i.image_link ? `<g:image_link>${x(i.image_link)}</g:image_link>` : ""}
${i.additional_images.map((u) => `<g:additional_image_link>${x(u)}</g:additional_image_link>`).join("\n")}
<g:availability>${i.availability}</g:availability>
<g:price>${i.price_bdt}.00 BDT</g:price>
${i.sale_price_bdt !== null ? `<g:sale_price>${i.sale_price_bdt}.00 BDT</g:sale_price>` : ""}
<g:condition>${i.condition}</g:condition>
${i.brand ? `<g:brand>${x(i.brand)}</g:brand>` : ""}
${i.gtin ? `<g:gtin>${x(i.gtin)}</g:gtin>` : ""}
${i.mpn ? `<g:mpn>${x(i.mpn)}</g:mpn>` : ""}
${!i.gtin && !i.mpn ? `<g:identifier_exists>no</g:identifier_exists>` : ""}
${i.product_type ? `<g:product_type>${x(i.product_type)}</g:product_type>` : ""}
<g:google_product_category>${x(i.google_category)}</g:google_product_category>
<g:shipping><g:country>BD</g:country><g:service>Standard</g:service><g:price>${i.shipping_bdt}.00 BDT</g:price></g:shipping>
</item>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${x(store.name)}</title>
<link>${x(absoluteUrl("/"))}</link>
<description>${x(store.tagline)}</description>
${entries}
</channel>
</rss>`;
}

const csvCell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Meta commerce catalog CSV (required columns first: id, title, description, availability, condition, price, link, image_link, brand). */
export async function facebookCatalogCsv(): Promise<string> {
  const items = await loadFeedItems();
  const header = ["id", "title", "description", "availability", "condition", "price", "sale_price", "link", "image_link", "additional_image_link", "brand", "gtin", "mpn", "item_group_id", "product_type", "google_product_category", "shipping"];
  const rows = items.map((i) =>
    [i.id, i.title, i.description, i.availability, i.condition, `${i.price_bdt}.00 BDT`, i.sale_price_bdt !== null ? `${i.sale_price_bdt}.00 BDT` : "", i.link, i.image_link ?? "", i.additional_images.join(","), i.brand ?? "", i.gtin ?? "", i.mpn ?? "", i.item_group_id, i.product_type ?? "", i.google_category, `BD::Standard:${i.shipping_bdt}.00 BDT`]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

/** Feed status for the SEO Center (§7.10): last generated + item count, stored in settings.feeds_status. */
export async function recordFeedRun(feed: "google_merchant" | "facebook_catalog", items: number, bytes: number): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin.from("settings").select("value").eq("key", "feeds_status").maybeSingle();
  const cur = (data?.value as Record<string, unknown> | null) ?? {};
  await admin.from("settings").upsert({ key: "feeds_status", value: { ...cur, [feed]: { generated_at: new Date().toISOString(), items, bytes } } as never, is_public: false }, { onConflict: "key" });
}
