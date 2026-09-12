import "server-only";

import { z } from "zod";
import type { TablesUpdate } from "@/lib/database.types";
import type { NormalizedCourierStatus } from "@/lib/integrations/courier/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { appendOrderEvent, transitionOrder, type OrderStatus } from "@/lib/orders/status";

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

export const NORMALIZED_STATUSES: NormalizedCourierStatus[] = ["created", "picked", "in_transit", "out_for_delivery", "delivered", "partial_delivered", "returned", "cancelled", "lost", "on_hold"];
export const TERMINAL_COURIER_STATUSES: NormalizedCourierStatus[] = ["delivered", "partial_delivered", "returned", "cancelled", "lost"];

/**
 * Default courier status string -> normalized status. The live map is
 * settings.courier_status_map (admin-editable, PART2 §14.4) merged over this,
 * so a new courier string can be remapped without a deploy.
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

let mapCache: { at: number; map: Record<string, NormalizedCourierStatus> } | null = null;

/** Status map = defaults merged with settings.courier_status_map (60 s cache). */
export async function loadStatusMap(): Promise<Record<string, NormalizedCourierStatus>> {
  if (mapCache && Date.now() - mapCache.at < 60_000) return mapCache.map;
  const { data } = await createAdminClient().from("settings").select("value").eq("key", "courier_status_map").maybeSingle();
  const custom = (data?.value ?? {}) as Record<string, string>;
  const map: Record<string, NormalizedCourierStatus> = { ...STATUS_MAP };
  for (const [k, v] of Object.entries(custom)) if (NORMALIZED_STATUSES.includes(v as NormalizedCourierStatus)) map[k.toLowerCase().trim()] = v as NormalizedCourierStatus;
  mapCache = { at: Date.now(), map };
  return map;
}

export function normalizeCourierStatus(raw: string, map: Record<string, NormalizedCourierStatus> = STATUS_MAP): NormalizedCourierStatus {
  return map[raw.toLowerCase().trim()] ?? "on_hold";
}

/**
 * The real webhook logic. The route handler validates the bearer token and
 * calls this; the mock courier's auto-advance and the polling fallback call it
 * directly so every path is exercised. On `returned` the items go back to stock
 * with a stock_movements row and the customer's risk profile is raised.
 */
export async function processCourierWebhook(payload: CourierWebhookPayload, source: "webhook" | "mock-tick" | "poll") {
  const admin = createAdminClient();
  const normalized = normalizeCourierStatus(payload.status, await loadStatusMap());

  const { data: shipment } = await admin
    .from("shipments")
    .select("id, order_id, normalized_status, courier_code")
    .or(`consignment_id.eq.${payload.consignment_id},invoice_ref.eq.${payload.invoice}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!shipment) return { ok: false as const, reason: "shipment not found" };

  const patch: TablesUpdate<"shipments"> = {
    status: payload.status,
    normalized_status: normalized,
    last_webhook_payload: { ...payload, _source: source, _received_at: new Date().toISOString() },
  };
  if (source === "poll") patch.last_polled_at = new Date().toISOString();
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
    if (transition.changed && normalized === "returned") await restockReturnedOrder(shipment.order_id);
  } else {
    await appendOrderEvent(shipment.order_id, "courier_status", { note: `${shipment.courier_code}: ${payload.status}`, metadata: { normalized, source } });
  }
  return { ok: true as const, shipmentId: shipment.id, normalized, transition };
}

/**
 * Returned parcel: every line goes back to stock (reason "return", linked to
 * the order) and the customer's notes carry a risk marker (PART2 §14.4).
 */
export async function restockReturnedOrder(orderId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("order_number, customer_id, order_items(variant_id, quantity)").eq("id", orderId).single();
  if (!order) return;
  const { count } = await admin.from("stock_movements").select("id", { count: "exact", head: true }).eq("order_id", orderId).eq("reason", "return");
  if ((count ?? 0) > 0) return; // idempotent: already restocked
  let restocked = 0;
  for (const it of order.order_items ?? []) {
    if (!it.variant_id) continue;
    const { error } = await admin.rpc("adjust_stock", { p_variant: it.variant_id, p_delta: it.quantity, p_reason: "return", p_order: orderId, p_note: `Returned by courier (${order.order_number})` });
    if (!error) restocked += it.quantity;
  }
  await appendOrderEvent(orderId, "restocked", { note: `${restocked} unit(s) returned to stock` });
  if (order.customer_id) {
    const { data: c } = await admin.from("customers").select("notes, total_returned").eq("id", order.customer_id).maybeSingle();
    const marker = `[risk] parcel ${order.order_number} returned (${(c?.total_returned ?? 0)} total)`;
    await admin.from("customers").update({ notes: c?.notes ? `${c.notes}\n${marker}` : marker }).eq("id", order.customer_id);
  }
}
