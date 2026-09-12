/**
 * RLS smoke test with the ANON key (no session).
 *   npm run db:verify-rls
 *
 * Expectations:
 *  - locked tables return zero rows WITHOUT an error (RLS on, no matching policy)
 *  - public views/tables are readable
 *  - products_public / product_variants_public never expose cost_bdt
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnv, requireEnv } from "./lib/env";

loadEnv();
const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
  auth: { persistSession: false },
});

type Row = { name: string; ok: boolean; detail: string };
const results: Row[] = [];

async function expectLocked(table: string) {
  const { data, error } = await supabase.from(table).select("*").limit(5);
  const ok = !error && (data?.length ?? 0) === 0;
  results.push({ name: `${table} (anon must see 0 rows)`, ok, detail: error ? `error: ${error.message}` : `${data?.length ?? 0} rows` });
}

async function expectReadable(table: string) {
  const { data, error } = await supabase.from(table).select("*").limit(1);
  results.push({ name: `${table} (anon may read)`, ok: !error, detail: error ? `error: ${error.message}` : `${data?.length ?? 0} row(s) sampled` });
}

async function expectNoColumn(view: string, column: string) {
  const { error } = await supabase.from(view).select(column).limit(1);
  // PostgREST returns an error when the column does not exist on the relation.
  const ok = !!error;
  results.push({ name: `${view} must not expose ${column}`, ok, detail: error ? "column absent (good)" : "COLUMN IS EXPOSED" });
}

(async () => {
  for (const t of [
    "customers", "addresses", "otp_codes", "carts", "cart_items", "orders", "order_items",
    "order_events", "payment_transactions", "coupons", "coupon_redemptions", "stock_movements",
    "couriers", "shipments", "courier_api_log", "courier_score_cache", "admin_users", "audit_log",
    "demo_sms_log", "demo_settings", "content_drafts", "content_revisions", "stock_reservations",
  ]) {
    await expectLocked(t);
  }
  for (const t of ["bd_locations", "categories", "brands", "collections", "products_public", "product_variants_public", "shipping_zones", "reviews", "content_blocks", "navigation_menus", "navigation_items", "theme_settings", "media_assets", "seo_meta", "redirects", "settings"]) {
    await expectReadable(t);
  }
  await expectNoColumn("products_public", "cost_bdt");
  await expectNoColumn("product_variants_public", "cost_bdt");

  const width = Math.max(...results.map((r) => r.name.length));
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(width)}  ${r.detail}`);
  }
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  process.exit(failed ? 1 : 0);
})();
