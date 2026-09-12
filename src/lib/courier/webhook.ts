import "server-only";

import { z } from "zod";
import type { NormalizedCourierStatus } from "@/lib/integrations/courier/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { transitionOrder, type OrderStatus } from "@/lib/orders/status";

/** Steadfast-shaped webhook payload (PART2 §14.4). */
export const courierWebhookSchema = z.object({
  notification_type: z.string().default("delivery_status"),
  consignment_id: z.union([z.string(), z.number()]).transform(String),
  invoice: z.string(),
  cod_amount: z.union([z.string(), z.number()]).optional(),
  status: z.string(),
  delivery_charge: z.union([z.string(), z.number()]).optional(),
  tracking_message: z.string().optional(),
  updated_at: z.string().optional(),
});
export type CourierWebhookPayload = z.infer<typeof courierWebhookSchema>;

/**
 * Courier status string -> normalized status. In production this map lives in
 * settings so a new courier string can be remapped without a deploy.
 */
export const STATUS_MAP: Record<string, NormalizedCourierStatus> = {
  in_review: "created",
  pending: "created",
  created: "created",
  picked: "picked",
  picked_up: "picked",
  in_transit: "in_transit",
  hold: "on_hold",
  on_hold: "on_hold",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  delivered_approval_pending: "delivered",
  partial_delivered: "partial_delivered",
  partial_delivered_approval_pending: "partial_delivered",
  cancelled: "cancelled",
  cancelled_approval_pending: "cancelled",
  returned: "returned",
  unknown_approval_pending: "on_hold",
  unknown: "on_hold",
  lost: "lost",
};

const ORDER_STATUS_FOR: Partial<Record<NormalizedCourierStatus, OrderStatus>> = {
  delivered: "delivered",
  partial_delivered: "delivered",
  returned: "returned",
  cancelled: "cancelled",
};

export function normalizeCourierStatus(raw: string): NormalizedCourierStatus {
  return STATUS_MAP[raw.toLowerCase().trim()] ?? "on_hold";
}

/**
 * The real webhook logic. The route handler validates the bearer token and
 * calls this; the mock courier's auto-advance calls it directly so the same
 * code path is exercised. Restocking on return is Phase 12.
 */
export async function processCourierWebhook(payload: CourierWebhookPayload, source: "webhook" | "mock-tick" | "poll") {
  const admin = createAdminClient();
  const normalized = normalizeCourierStatus(payload.status);

  const { data: shipment } = await admin
    .from("shipments")
    .select("id, order_id, normalized_status, courier_code")
    .or(`consignment_id.eq.${payload.consignment_id},invoice_ref.eq.${payload.invoice}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!shipment) return { ok: false as const, reason: "shipment not found" };

  const patch: Record<string, unknown> = {
    status: payload.status,
    normalized_status: normalized,
    last_webhook_payload: { ...payload, _source: source, _received_at: new Date().toISOString() },
  };
  if (normalized === "delivered" || normalized === "partial_delivered") patch.delivered_at = new Date().toISOString();
  if (payload.delivery_charge !== undefined) patch.delivery_charge_bdt = Math.round(Number(payload.delivery_charge));
  await admin.from("shipments").update(patch).eq("id", shipment.id);

  const orderStatus = ORDER_STATUS_FOR[normalized];
  let transition: { changed: boolean; from: string; to: string } | null = null;
  if (orderStatus) {
    transition = await transitionOrder(shipment.order_id, orderStatus, {
      actorType: "system",
      eventType: "courier_status",
      note: `${shipment.courier_code}: ${payload.status}${payload.tracking_message ? ` - ${payload.tracking_message}` : ""}`,
      metadata: { normalized, source },
    });
  } else {
    await admin.from("order_events").insert({
      order_id: shipment.order_id,
      event_type: "courier_status",
      actor_type: "system",
      note: `${shipment.courier_code}: ${payload.status}`,
      metadata: { normalized, source } as never,
    });
  }
  return { ok: true as const, shipmentId: shipment.id, normalized, transition };
}
