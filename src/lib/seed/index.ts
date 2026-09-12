import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { seedCatalog, type CatalogIds } from "./catalog";
import { deleteSeedAuthUsers, seedCustomers, type SeedCustomer } from "./customers";
import { SEED_IMAGES } from "./data/images.generated";
import { generateOrderBatch, refreshCustomerCounters } from "./orders";
import { seedReviews } from "./reviews";
import { SEED } from "./rng";
import { seedSettings } from "./settings";
import { seedAdmin, seedContent } from "./content";
import { seedFraud } from "./fraud";
import { seedLandingPages } from "./landing";
import { seedPages } from "./pages";

export const ORDER_COUNT = 320;
export const ORDER_DAYS = 120;
export const CAMPAIGN_DAY_AGO = 40;

export interface SeedSummary {
  products: number;
  customers: number;
  orders: number;
  reviews: number;
  ms: number;
}

function primaryImages(): Map<string, string | null> {
  return new Map(Object.entries(SEED_IMAGES).map(([slug, imgs]) => [slug, imgs[0]?.url ?? null]));
}

/** Full idempotent seed: catalog -> customers -> 320 orders over 120 days -> reviews. */
export async function seedAll(): Promise<SeedSummary> {
  const t0 = Date.now();
  await seedSettings();
  await seedFraud();
  const catalog = await seedCatalog();
  const customers = await seedCustomers();
  const { count } = await generateOrderBatch(customers, catalog, {
    count: ORDER_COUNT,
    daysBack: ORDER_DAYS,
    seed: SEED,
    campaignDayAgo: CAMPAIGN_DAY_AGO,
    images: primaryImages(),
  });
  const reviews = await seedReviews();
  await refreshCustomerCounters();
  await seedContent();
  await seedLandingPages();
  await seedPages();
  await seedAdmin();
  const summary = { products: catalog.products.size, customers: customers.length, orders: count, reviews, ms: Date.now() - t0 };
  console.log(`[seed] done in ${summary.ms} ms`);
  return summary;
}

/** POST /api/demo/reset - wipe transactional data, re-seed it, keep catalog + customers. */
export async function resetTransactional(): Promise<SeedSummary> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("demo_truncate_transactional");
  if (error) throw new Error(`demo_truncate_transactional: ${error.message}`);
  return seedAll();
}

/** POST /api/demo/reset-all - full wipe (including seeded auth users) and re-seed. */
export async function resetAll(): Promise<SeedSummary & { auth_users_removed: number }> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("demo_truncate_all");
  if (error) throw new Error(`demo_truncate_all: ${error.message}`);
  const removed = await deleteSeedAuthUsers();
  const summary = await seedAll();
  return { ...summary, auth_users_removed: removed };
}

/** POST /api/demo/generate-orders?n=20 - fresh orders over the last 3 days, new every call. */
export async function generateOrders(n: number): Promise<{ count: number }> {
  const catalog = await loadCatalogIds();
  const customers = await loadCustomers();
  if (customers.length === 0) throw new Error("No customers - run the seed first");
  const res = await generateOrderBatch(customers, catalog, { count: n, daysBack: 3, seed: Date.now() >>> 0, images: primaryImages() });
  await refreshCustomerCounters();
  return { count: res.count };
}

async function loadCatalogIds(): Promise<CatalogIds> {
  const admin = createAdminClient();
  const { data: products } = await admin.from("products").select("id, slug");
  const { data: variants } = await admin.from("product_variants").select("id, sku, product_id, price_bdt, option_value, stock_qty");
  const productMap = new Map((products ?? []).map((p) => [p.slug, p.id]));
  const slugById = new Map((products ?? []).map((p) => [p.id, p.slug]));
  const variantMap: CatalogIds["variants"] = new Map();
  for (const v of variants ?? []) {
    const slug = slugById.get(v.product_id);
    if (!slug) continue;
    if (!variantMap.has(slug)) variantMap.set(slug, []);
    variantMap.get(slug)!.push({ id: v.id, sku: v.sku, price_bdt: v.price_bdt, label: v.option_value, stock_qty: v.stock_qty });
  }
  return { brands: new Map(), categories: new Map(), collections: new Map(), products: productMap, variants: variantMap };
}

async function loadCustomers(): Promise<SeedCustomer[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("customers").select("id, phone, full_name, email, created_at, addresses(recipient_name, phone, division, district, upazila, area, street_address, landmark, is_default)");
  return (data ?? [])
    .map((c) => {
      const addrs = (c.addresses ?? []) as SeedCustomer["address"][] & { is_default?: boolean }[];
      const a = (addrs.find((x) => (x as { is_default?: boolean }).is_default) ?? addrs[0]) as SeedCustomer["address"] | undefined;
      if (!a) return null;
      return { id: c.id, phone: c.phone, full_name: c.full_name ?? "", name_bn: "", email: c.email, created_at: c.created_at, weight: 1, address: { recipient_name: a.recipient_name ?? c.full_name ?? "", phone: a.phone ?? c.phone, division: a.division ?? "", district: a.district ?? "", upazila: a.upazila ?? "", area: a.area ?? "", street_address: a.street_address, landmark: a.landmark ?? "" } } satisfies SeedCustomer;
    })
    .filter((c): c is SeedCustomer => c !== null);
}

export { seedCatalog } from "./catalog";
export { seedCustomers } from "./customers";
export { seedSettings } from "./settings";
export { seedAdmin, seedContent } from "./content";
export { seedFraud } from "./fraud";
export { seedLandingPages } from "./landing";
export { seedPages } from "./pages";
