import "server-only";

import { processCourierWebhook } from "@/lib/courier/webhook";
import { SPEED_STEP_SECONDS } from "@/lib/orders/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDemoSetting } from "./settings";

/**
 * Mock courier auto-advance (BUILD_PROMPT_PART3 §20.3).
 * created -> picked -> in_transit -> out_for_delivery -> delivered (90%) | returned (10%)
 * Spec timings at "realistic": 2 / 5 / 8 / 12 minutes; "fast" scales to seconds;
 * "instant" advances every step in one tick.
 *
 * Called by POST /api/demo/courier/tick (Netlify scheduled function every 2 min)
 * and by the demo panel's "Run full lifecycle".
 */
const CHAIN = ["created", "picked", "in_transit", "out_for_delivery"] as const;
/** Spec: 2, 5, 8, 12 minutes cumulative -> gaps 2, 3, 3, 4 (multiples of the step) */
const GAP_MULTIPLIER = [1, 1.5, 1.5, 2];

export async function runCourierTick(opts: { orderId?: string; force?: boolean } = {}) {
  const admin = createAdminClient();
  const speed = await getDemoSetting("courier_speed");
  const step = SPEED_STEP_SECONDS[speed];
  const now = Date.now();

  let q = admin
    .from("shipments")
    .select("id, order_id, normalized_status, consignment_id, invoice_ref, note, next_transition_at, cod_amount_bdt")
    .eq("courier_code", "mock")
    .in("normalized_status", [...CHAIN]);
  if (opts.orderId) q = q.eq("order_id", opts.orderId);
  if (!opts.force && speed !== "instant") q = q.lte("next_transition_at", new Date(now).toISOString());
  const { data: due, error } = await q.limit(200);
  if (error) throw new Error(error.message);

  const advanced: Array<{ shipmentId: string; from: string; to: string }> = [];
  for (const s of due ?? []) {
    let current = s.normalized_status as (typeof CHAIN)[number];
    // instant / force: walk the whole chain in one go
    const steps = speed === "instant" || opts.force ? CHAIN.length : 1;
    for (let i = 0; i < steps; i++) {
      const idx = CHAIN.indexOf(current);
      if (idx === -1) break;
      const last = idx === CHAIN.length - 1;
      const forceReturn = s.note === "demo:force_return";
      const goesToReturn = last && (forceReturn || hashToPercent(s.id) < 10);
      const next = last ? (goesToReturn ? "returned" : "delivered") : CHAIN[idx + 1];

      await processCourierWebhook(
        {
          notification_type: "delivery_status",
          consignment_id: s.consignment_id ?? "",
          invoice: s.invoice_ref ?? "",
          cod_amount: s.cod_amount_bdt,
          status: next,
          delivery_charge: next === "delivered" ? 60 : undefined,
          tracking_message: `Mock courier: ${next.replace(/_/g, " ")}`,
          updated_at: new Date().toISOString(),
        },
        "mock-tick",
      );
      advanced.push({ shipmentId: s.id, from: current, to: next });

      if (last) break;
      current = next as (typeof CHAIN)[number];
      const gap = step * GAP_MULTIPLIER[idx + 1] * 1000;
      await admin.from("shipments").update({ next_transition_at: new Date(Date.now() + gap).toISOString() }).eq("id", s.id);
    }
  }
  return { speed, checked: due?.length ?? 0, advanced };
}

/** Stable 0-99 from a uuid so the same parcel always makes the same choice. */
function hashToPercent(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 100;
}
