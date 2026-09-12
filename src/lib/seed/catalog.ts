import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { BRANDS, CATEGORIES, COLLECTIONS, PRODUCTS, type SeedProduct } from "./data/catalog";
import { SEED_IMAGES } from "./data/images.generated";
import { Rng, SEED, hashString } from "./rng";

export interface CatalogIds {
  brands: Map<string, string>;
  categories: Map<string, string>;
  collections: Map<string, string>;
  products: Map<string, string>;
  /** product slug -> variants [{id, sku, price, label}] */
  variants: Map<string, { id: string; sku: string; price_bdt: number; label: string | null; stock_qty: number }[]>;
}

function skuFor(p: SeedProduct, suffix?: string): string {
  const brand = p.brand.slice(0, 3).toUpperCase();
  const h = (hashString(p.slug) % 9000) + 1000;
  return suffix ? `${brand}-${h}-${suffix}` : `${brand}-${h}`;
}

function fail(step: string, error: { message: string } | null): asserts error is null {
  if (error) throw new Error(`seed catalog ${step}: ${error.message}`);
}

/** Idempotent: every row is upserted on its slug / sku / composite key. */
export async function seedCatalog(): Promise<CatalogIds> {
  const admin = createAdminClient();
  const rng = new Rng(SEED ^ 0xc47a);

  // brands
  const { data: brandRows, error: bErr } = await admin
    .from("brands")
    .upsert(BRANDS.map((b) => ({ slug: b.slug, name: b.name, is_active: true })), { onConflict: "slug" })
    .select("id, slug");
  fail("brands", bErr);
  const brands = new Map(brandRows!.map((r) => [r.slug, r.id]));

  // categories
  const { data: catRows, error: cErr } = await admin
    .from("categories")
    .upsert(CATEGORIES.map((c) => ({ slug: c.slug, name_en: c.name_en, name_bn: c.name_bn, description_en: c.description_en, position: c.position, is_active: true })), { onConflict: "slug" })
    .select("id, slug");
  fail("categories", cErr);
  const categories = new Map(catRows!.map((r) => [r.slug, r.id]));

  // collections
  const { data: colRows, error: colErr } = await admin
    .from("collections")
    .upsert(COLLECTIONS.map((c) => ({ slug: c.slug, title_en: c.title_en, title_bn: c.title_bn, description_en: c.description_en, position: c.position, is_active: true, is_automatic: !c.products, rules: (c.rules ?? null) as never })), { onConflict: "slug" })
    .select("id, slug");
  fail("collections", colErr);
  const collections = new Map(colRows!.map((r) => [r.slug, r.id]));

  // products - published_at spread over the last 200 days for "newest" sorting
  const now = Date.now();
  const productRows = PRODUCTS.map((p, i) => ({
    slug: p.slug,
    brand_id: brands.get(p.brand) ?? null,
    title_en: p.title_en,
    title_bn: p.title_bn ?? null,
    short_description: p.short,
    description_en: `${p.short}\n\n${p.highlights.map((h) => `- ${h}`).join("\n")}\n\nBacked by a ${p.warranty_months}-month warranty and delivered anywhere in Bangladesh.`,
    specs: p.specs.map(([label, value]) => ({ label, value })) as never,
    highlights: p.highlights,
    status: "active" as const,
    is_featured: Boolean(p.featured),
    warranty_months: p.warranty_months,
    published_at: new Date(now - (200 - i * 4 + rng.int(0, 3)) * 86_400_000).toISOString(),
  }));
  const { data: prodRows, error: pErr } = await admin.from("products").upsert(productRows, { onConflict: "slug" }).select("id, slug");
  fail("products", pErr);
  const products = new Map(prodRows!.map((r) => [r.slug, r.id]));

  // variants
  const variantRows: Array<{ product_id: string; sku: string; option_name: string | null; option_value: string | null; price_bdt: number; compare_at_price_bdt: number | null; cost_bdt: number; stock_qty: number; low_stock_threshold: number; weight_grams: number; is_default: boolean; position: number }> = [];
  for (const p of PRODUCTS) {
    const pid = products.get(p.slug)!;
    if (p.colors?.length) {
      p.colors.forEach((c, i) =>
        variantRows.push({ product_id: pid, sku: skuFor(p, c.sku_suffix), option_name: "Color", option_value: c.option_value, price_bdt: p.price, compare_at_price_bdt: p.compare_at ?? null, cost_bdt: p.cost, stock_qty: c.stock, low_stock_threshold: 5, weight_grams: p.weight_grams, is_default: i === 0, position: i }),
      );
    } else {
      variantRows.push({ product_id: pid, sku: skuFor(p), option_name: null, option_value: null, price_bdt: p.price, compare_at_price_bdt: p.compare_at ?? null, cost_bdt: p.cost, stock_qty: p.stock, low_stock_threshold: 5, weight_grams: p.weight_grams, is_default: true, position: 0 });
    }
  }
  const { data: varRows, error: vErr } = await admin.from("product_variants").upsert(variantRows, { onConflict: "sku" }).select("id, sku, product_id, price_bdt, option_value, stock_qty");
  fail("variants", vErr);
  const variants: CatalogIds["variants"] = new Map();
  const slugById = new Map([...products].map(([slug, id]) => [id, slug]));
  for (const v of varRows!) {
    const slug = slugById.get(v.product_id)!;
    if (!variants.has(slug)) variants.set(slug, []);
    variants.get(slug)!.push({ id: v.id, sku: v.sku, price_bdt: v.price_bdt, label: v.option_value, stock_qty: v.stock_qty });
  }

  // product_categories
  const { error: pcErr } = await admin
    .from("product_categories")
    .upsert(PRODUCTS.map((p) => ({ product_id: products.get(p.slug)!, category_id: categories.get(p.category)! })), { onConflict: "product_id,category_id" });
  fail("product_categories", pcErr);

  // collection_products: manual lists + rule-based fills (computed here; the storefront can also evaluate rules live)
  const collectionProducts: { collection_id: string; product_id: string; position: number }[] = [];
  for (const c of COLLECTIONS) {
    const cid = collections.get(c.slug)!;
    let slugs: string[] = c.products ?? [];
    if (!c.products) {
      if (c.slug === "new-arrivals") slugs = PRODUCTS.slice(-12).map((p) => p.slug).reverse();
      if (c.slug === "under-1000") slugs = PRODUCTS.filter((p) => p.price < 1000).map((p) => p.slug);
      if (c.slug === "eid-offers") slugs = PRODUCTS.filter((p) => p.compare_at).map((p) => p.slug);
    }
    slugs.forEach((slug, i) => collectionProducts.push({ collection_id: cid, product_id: products.get(slug)!, position: i }));
  }
  const { error: cpErr } = await admin.from("collection_products").upsert(collectionProducts, { onConflict: "collection_id,product_id" });
  fail("collection_products", cpErr);

  // images: from the generated manifest (npm run seed:images). Skipped when empty.
  let imageCount = 0;
  for (const [slug, imgs] of Object.entries(SEED_IMAGES)) {
    const pid = products.get(slug);
    if (!pid || !imgs.length) continue;
    for (const [i, img] of imgs.entries()) {
      const row = { product_id: pid, url: img.url, alt_text_en: img.alt, width: img.width, height: img.height, position: i, blur_data_url: img.blurDataUrl, manifest: img.manifest as never, content_hash: img.hash, format: "jpeg", bytes: img.bytes };
      const { data: existing } = await admin.from("product_images").select("id").eq("product_id", pid).eq("content_hash", img.hash).maybeSingle();
      const res = existing ? await admin.from("product_images").update(row).eq("id", existing.id) : await admin.from("product_images").insert(row);
      fail("product_images", res.error);
      imageCount++;
    }
  }

  // shipping zones + rates (PART1 §4.5)
  const zones = [
    { name: "Dhaka City", districts: ["Dhaka"], rate: 60, free_above: 2000, days: "1-2 days" },
    { name: "Dhaka Suburb", districts: ["Gazipur", "Narayanganj", "Manikganj", "Munshiganj", "Narsingdi"], rate: 100, free_above: 3000, days: "2-3 days" },
    { name: "Outside Dhaka", districts: [], rate: 130, free_above: null as number | null, days: "3-5 days" },
  ];
  for (const [i, z] of zones.entries()) {
    const { data: existing } = await admin.from("shipping_zones").select("id").eq("name", z.name).maybeSingle();
    const zoneRow = { name: z.name, districts: z.districts, is_active: true };
    const zoneRes = existing ? await admin.from("shipping_zones").update(zoneRow).eq("id", existing.id).select("id").single() : await admin.from("shipping_zones").insert(zoneRow).select("id").single();
    fail("shipping_zones", zoneRes.error);
    const zoneId = zoneRes.data!.id;
    const { data: rate } = await admin.from("shipping_rates").select("id").eq("zone_id", zoneId).eq("name", "Standard").maybeSingle();
    const rateRow = { zone_id: zoneId, name: "Standard", rate_bdt: z.rate, free_above_bdt: z.free_above, estimated_days: z.days, position: i };
    const rateRes = rate ? await admin.from("shipping_rates").update(rateRow).eq("id", rate.id) : await admin.from("shipping_rates").insert(rateRow);
    fail("shipping_rates", rateRes.error);
  }

  // couriers
  const { error: courErr } = await admin.from("couriers").upsert(
    [
      { code: "mock", name: "Mock Courier (demo)", is_active: true, is_default: true, config: { demo: true } as never, supported_districts: [] },
      { code: "steadfast", name: "Steadfast", is_active: false, is_default: false, config: { base_url: "https://portal.packzy.com/api/v1" } as never, supported_districts: [] },
    ],
    { onConflict: "code" },
  );
  fail("couriers", courErr);

  // a couple of coupons so checkout has something to validate later
  const { error: cpnErr } = await admin.from("coupons").upsert(
    [
      { code: "EID10", description: "10% off Eid offers", type: "percentage" as const, value: 10, min_order_bdt: 1000, max_discount_bdt: 500, usage_limit: 500, is_active: true },
      { code: "FREESHIP", description: "Free delivery inside Dhaka", type: "free_shipping" as const, value: 0, min_order_bdt: 1500, is_active: true },
      { code: "WELCOME100", description: "৳100 off first order", type: "fixed" as const, value: 100, min_order_bdt: 800, is_active: true },
    ],
    { onConflict: "code" },
  );
  fail("coupons", cpnErr);

  console.log(`[seed] catalog: ${brands.size} brands, ${categories.size} categories, ${collections.size} collections, ${products.size} products, ${varRows!.length} variants, ${imageCount} images`);
  return { brands, categories, collections, products, variants };
}
