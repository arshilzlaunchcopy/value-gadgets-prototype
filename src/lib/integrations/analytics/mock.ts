import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { AnalyticsAdapter, AnalyticsResult, PurchaseEvent } from "./types";

/** Demo adapter: records the event it would have sent (visible in the SEO Center). */
export class MockAnalyticsAdapter implements AnalyticsAdapter {
  readonly name = "Mock conversions";
  readonly isMock = true;

  async purchase(e: PurchaseEvent): Promise<AnalyticsResult> {
    const { error } = await createAdminClient()
      .from("analytics_events")
      .upsert({ provider: "mock", event_name: "Purchase", event_id: e.eventId, order_id: e.orderId, payload: { value: e.valueBdt, currency: e.currency, contents: e.contents, source_url: e.sourceUrl } as never, response: { mock: true } as never, status: "sent" }, { onConflict: "provider,event_name,event_id" });
    return { ok: !error, provider: "mock", error: error?.message };
  }
}
