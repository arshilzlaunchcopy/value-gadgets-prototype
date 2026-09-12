import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { KNOWN_PHONES } from "@/lib/demo/known-phones";
import { landingRequiresOtp } from "@/lib/landing/queries";
import { submitQuickOrder } from "@/lib/landing/quick-order";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Landing-page quick order (PART2 §15.2): three fields, same placeOrder path,
 * OTP only above the page's threshold, attribution to the page and A/B variant.
 */
describe("quick order form", () => {
  const admin = createAdminClient();
  const tag = randomBytes(4).toString("hex");
  const trusted = KNOWN_PHONES.find((k) => k.label.startsWith("Excellent"))!.phone;
  let productId: string;
  let variantId: string;
  let lpId: string;
  let variantBId: string;
  const orderIds: string[] = [];

  beforeAll(async () => {
    const { data: p } = await admin.from("products").insert({ slug: `__lp-${tag}`, title_en: "Landing test product", status: "active", published_at: new Date().toISOString() }).select("id").single();
    productId = p!.id;
    const { data: v } = await admin.from("product_variants").insert({ product_id: productId, sku: `LP-${tag}`, price_bdt: 900, stock_qty: 10, is_default: true }).select("id").single();
    variantId = v!.id;
    const { data: lp } = await admin.from("landing_pages").insert({ slug: `__lp-${tag}`, title: "Test landing", product_id: productId, status: "published", otp_mode: "above_threshold", otp_threshold_bdt: 2000, ab_enabled: true }).select("id, variant_b_id").single();
    lpId = lp!.id;
    variantBId = lp!.variant_b_id;
    await admin.from("demo_settings").upsert({ key: "fraud_score_override", value: null as never }, { onConflict: "key" });
  });

  afterAll(async () => {
    if (orderIds.length) await admin.from("orders").delete().in("id", orderIds);
    await admin.from("landing_pages").delete().eq("id", lpId);
    await admin.from("products").delete().eq("id", productId);
  });

  const page = () => ({ id: lpId, slug: `__lp-${tag}`, title: "Test landing", product_id: productId, chrome: "minimal" as const, otp_mode: "above_threshold" as const, otp_threshold_bdt: 2000, pixel_event: null, ab_enabled: true, variant_b_id: variantBId, meta_title: null, meta_description: null, og_image_url: null, updated_at: "" });
  const input = (quantity: number, ab: "a" | "b") => ({ landing_slug: `__lp-${tag}`, variant_id: variantId, quantity, name: "Landing Buyer", phone: trusted, district: "Dhaka", address: `House ${tag}, Road 2, Banani`, note: "", ab_variant: ab, utm: { source: "facebook", medium: "cpc", campaign: "eid", landing_page: null, referrer: null } });

  it("decides OTP by threshold", () => {
    expect(landingRequiresOtp({ otp_mode: "never", otp_threshold_bdt: 0 }, 99_999)).toBe(false);
    expect(landingRequiresOtp({ otp_mode: "always", otp_threshold_bdt: 0 }, 1)).toBe(true);
    expect(landingRequiresOtp({ otp_mode: "above_threshold", otp_threshold_bdt: 2000 }, 1999)).toBe(false);
    expect(landingRequiresOtp({ otp_mode: "above_threshold", otp_threshold_bdt: 2000 }, 2000)).toBe(true);
  });

  it("places a COD order without OTP under the threshold and attributes it", async () => {
    const r = await submitQuickOrder(page(), input(1, "b"), { ip: "10.9.9.9", userAgent: "vitest" }, { sessionPhone: null });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    orderIds.push(r.orderId);
    const { data: o } = await admin.from("orders").select("source, landing_page_id, ab_variant, is_phone_verified, utm_source, utm_campaign, landing_page, status, shipping_address, customer_name").eq("id", r.orderId).single();
    expect(o!.source).toBe("landing");
    expect(o!.landing_page_id).toBe(lpId);
    expect(o!.ab_variant).toBe("b");
    expect(o!.is_phone_verified).toBe(false);
    expect(o!.utm_source).toBe("facebook");
    expect(o!.landing_page).toBe(`/lp/__lp-${tag}`);
    expect(o!.status).toBe("shipped"); // trusted phone, under the COD ceiling: auto-confirmed AND auto-dispatched
    expect((o!.shipping_address as { district: string }).district).toBe("Dhaka");
    // the one-shot cart is gone
    const { count } = await admin.from("carts").select("id", { count: "exact", head: true }).like("session_token", "qo-%");
    expect(count ?? 0).toBe(0);
  });

  it("asks for OTP above the threshold instead of placing the order", async () => {
    const r = await submitQuickOrder(page(), input(3, "a"), { ip: "10.9.9.10", userAgent: "vitest" }, { sessionPhone: null });
    expect(r.ok).toBe(false);
    expect("needsOtp" in r && r.needsOtp).toBe(true);
  });

  it("rejects an unknown or out-of-stock quantity", async () => {
    const r = await submitQuickOrder(page(), input(10, "a"), { ip: "10.9.9.11", userAgent: "vitest" }, { sessionPhone: null });
    expect(r.ok).toBe(false);
    // stock is 10 minus the order above; a request for 10 cannot be satisfied
    expect("code" in r && r.code).toBe("OUT_OF_STOCK");
  });
});
