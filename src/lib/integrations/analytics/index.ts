import "server-only";

import { isDemoMode } from "@/lib/env";
import { getSeoSettings } from "@/lib/seo/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { MetaCapiAdapter } from "./meta-capi";
import { MockAnalyticsAdapter } from "./mock";
import type { AnalyticsAdapter, PurchaseEvent } from "./types";

export type { AnalyticsAdapter, AnalyticsResult, PurchaseEvent } from "./types";

class NoopAdapter implements AnalyticsAdapter {
  readonly name = "Conversions API (not configured)";
  readonly isMock = true;
  async purchase() {
    return { ok: true, provider: "noop", skipped: true };
  }
}

/** Demo -> mock (logs to analytics_events). Live -> Meta CAPI when a pixel id + token are configured, else no-op. */
export async function getAnalytics(): Promise<AnalyticsAdapter> {
  if (isDemoMode()) return new MockAnalyticsAdapter();
  const seo = await getSeoSettings();
  if (seo.meta_pixel_id && seo.meta_capi_token) return new MetaCapiAdapter(seo.meta_pixel_id, seo.meta_capi_token);
  return new NoopAdapter();
}

/**
 * Fire the server-side Purchase for a paid/confirmed order. event_id = order id,
 * which the confirmation page also uses for the browser pixel (dedup, §7.8).
 * Never throws; a tracking failure must not affect the order.
 */
export async function trackPurchaseServerSide(orderId: string, meta: { ip?: string | null; userAgent?: string | null } = {}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: o } = await admin.from("orders").select("id, order_number, total_bdt, customer_phone, customer_email, landing_page, order_items(variant_id, quantity, unit_price_bdt)").eq("id", orderId).single();
    if (!o) return;
    const e: PurchaseEvent = {
      eventId: o.id,
      orderId: o.id,
      orderNumber: o.order_number,
      valueBdt: o.total_bdt,
      currency: "BDT",
      contents: (o.order_items ?? []).map((i) => ({ id: i.variant_id ?? "", quantity: i.quantity, price_bdt: i.unit_price_bdt })),
      customer: { phone: o.customer_phone, email: o.customer_email, ip: meta.ip ?? null, userAgent: meta.userAgent ?? null },
      sourceUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/order/${o.order_number}/confirmation`,
    };
    await (await getAnalytics()).purchase(e);
  } catch (err) {
    console.warn("[analytics] purchase event failed:", err instanceof Error ? err.message : err);
  }
}
