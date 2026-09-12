import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AnalyticsAdapter, AnalyticsResult, PurchaseEvent } from "./types";

const sha256 = (s: string) => createHash("sha256").update(s.trim().toLowerCase()).digest("hex");

/**
 * Meta Conversions API (BUILD_PROMPT §7.8). Customer identifiers are hashed as
 * Meta requires; event_id matches the browser pixel so Meta deduplicates.
 * Every call is logged to analytics_events.
 */
export class MetaCapiAdapter implements AnalyticsAdapter {
  readonly name = "Meta Conversions API";
  readonly isMock = false;

  constructor(private readonly pixelId: string, private readonly token: string) {}

  async purchase(e: PurchaseEvent): Promise<AnalyticsResult> {
    const admin = createAdminClient();
    const body = {
      data: [
        {
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          event_id: e.eventId,
          event_source_url: e.sourceUrl,
          action_source: "website",
          user_data: { ph: [sha256(e.customer.phone.replace(/\D/g, ""))], ...(e.customer.email ? { em: [sha256(e.customer.email)] } : {}), ...(e.customer.ip ? { client_ip_address: e.customer.ip } : {}), ...(e.customer.userAgent ? { client_user_agent: e.customer.userAgent } : {}) },
          custom_data: { currency: e.currency, value: e.valueBdt, order_id: e.orderNumber, contents: e.contents.map((c) => ({ id: c.id, quantity: c.quantity, item_price: c.price_bdt })), content_type: "product" },
        },
      ],
    };
    let response: unknown;
    let ok = false;
    let error: string | undefined;
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${this.pixelId}/events?access_token=${encodeURIComponent(this.token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
      response = await res.json().catch(() => null);
      ok = res.ok;
      if (!ok) error = `HTTP ${res.status}`;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    await admin.from("analytics_events").upsert({ provider: "meta_capi", event_name: "Purchase", event_id: e.eventId, order_id: e.orderId, payload: body as never, response: (response ?? { error }) as never, status: ok ? "sent" : "failed" }, { onConflict: "provider,event_name,event_id" });
    return { ok, provider: "meta_capi", error, raw: response };
  }
}
