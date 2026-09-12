import "server-only";

import { dispatchOrder } from "./dispatch";
import { appendOrderEvent } from "./status";

/**
 * Auto-dispatch after auto-confirmation (PART2 §14.3). Never throws: a courier
 * outage must not fail checkout or the IPN handler. Failures are recorded as an
 * order event so the order shows up for manual dispatch.
 */
export async function autoDispatch(orderId: string, reason: string): Promise<{ ok: boolean; trackingCode?: string | null; error?: string }> {
  try {
    const r = await dispatchOrder(orderId, { actorType: "system" });
    if (!r.reused) await appendOrderEvent(orderId, "auto_dispatched", { note: `Auto-dispatched (${reason})`, metadata: { tracking_code: r.trackingCode } });
    return { ok: true, trackingCode: r.trackingCode };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[dispatch] auto-dispatch failed for ${orderId}: ${message}`);
    await appendOrderEvent(orderId, "auto_dispatch_failed", { note: `Auto-dispatch failed: ${message}. Dispatch manually from the order page.` }).catch(() => undefined);
    return { ok: false, error: message };
  }
}
