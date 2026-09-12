import "server-only";

import { getCourier } from "@/lib/integrations/courier";
import { createAdminClient } from "@/lib/supabase/admin";
import { processCourierWebhook, TERMINAL_COURIER_STATUSES } from "./webhook";

/**
 * Polling fallback (PART2 §14.4): webhooks get missed. Every 30 minutes poll
 * status_by_invoice for shipments that are not terminal and were last polled
 * more than `staleHours` ago (default 2). Each result runs through the exact
 * same processing as a webhook.
 */
export async function pollOpenShipments(opts: { staleHours?: number; limit?: number } = {}) {
  const admin = createAdminClient();
  const staleHours = opts.staleHours ?? 2;
  const cutoff = new Date(Date.now() - staleHours * 3_600_000).toISOString();
  const courier = getCourier();
  const { data: open, error } = await admin
    .from("shipments")
    .select("id, order_id, invoice_ref, consignment_id, normalized_status, last_polled_at")
    .eq("courier_code", courier.code)
    .not("normalized_status", "in", `(${TERMINAL_COURIER_STATUSES.join(",")})`)
    .or(`last_polled_at.is.null,last_polled_at.lt.${cutoff}`)
    .order("last_polled_at", { ascending: true, nullsFirst: true })
    .limit(opts.limit ?? 100);
  if (error) throw new Error(error.message);

  const results: Array<{ invoice: string; from: string; to: string; changed: boolean }> = [];
  for (const s of open ?? []) {
    if (!s.invoice_ref) continue;
    try {
      const status = await courier.statusByInvoice(s.invoice_ref);
      await admin.from("shipments").update({ last_polled_at: new Date().toISOString() }).eq("id", s.id);
      if (status.normalized === s.normalized_status) {
        results.push({ invoice: s.invoice_ref, from: s.normalized_status, to: status.normalized, changed: false });
        continue;
      }
      const r = await processCourierWebhook(
        { notification_type: "delivery_status", consignment_id: status.consignmentId ?? s.consignment_id ?? "", invoice: s.invoice_ref, status: status.rawStatus, updated_at: status.updatedAt },
        "poll",
      );
      results.push({ invoice: s.invoice_ref, from: s.normalized_status, to: status.normalized, changed: r.ok });
    } catch (err) {
      results.push({ invoice: s.invoice_ref, from: s.normalized_status, to: `error: ${err instanceof Error ? err.message : err}`, changed: false });
    }
  }
  return { checked: open?.length ?? 0, results };
}
