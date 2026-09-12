import "server-only";

import { getDemoSetting, setDemoSetting, type CourierSpeed } from "@/lib/demo/settings";
import { isDemoMode } from "@/lib/env";
import { getCourier } from "@/lib/integrations/courier";
import type { DispatchPayload } from "@/lib/integrations/courier/types";
import { normalizeBD } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { transitionOrder } from "./status";

interface ShippingAddress {
  recipient_name?: string;
  street_address?: string;
  area?: string;
  upazila?: string;
  district?: string;
  division?: string;
}

/** Seconds until the FIRST transition (created -> picked) per speed; later steps scale. */
export const SPEED_STEP_SECONDS: Record<CourierSpeed, number> = { instant: 0, fast: 3, realistic: 120 };

export function buildDispatchPayload(order: {
  order_number: string;
  customer_phone: string;
  customer_note: string | null;
  payment_method: string;
  total_bdt: number;
  shipping_address: unknown;
}, itemSummary: string): DispatchPayload {
  const a = (order.shipping_address ?? {}) as ShippingAddress;
  return {
    invoice: order.order_number,
    recipientName: a.recipient_name ?? "",
    recipientPhone: normalizeBD(order.customer_phone) ?? order.customer_phone,
    recipientAddress: [a.street_address, a.area, a.upazila, a.district, a.division].filter(Boolean).join(", "),
    // cod_amount MUST be 0 for prepaid orders (PART2 §14.3)
    codAmountBdt: order.payment_method === "cod" ? order.total_bdt : 0,
    note: [order.customer_note, itemSummary].filter(Boolean).join(" | "),
  };
}

/**
 * Dispatch an order to the courier (mock or real - this code does not know
 * which). Idempotent: an existing non-cancelled shipment is returned as-is.
 */
export async function dispatchOrder(orderId: string, opts: { actorType?: "admin" | "system"; actorId?: string | null } = {}) {
  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("orders")
    .select("id, order_number, status, customer_phone, customer_note, payment_method, total_bdt, shipping_address, order_items(product_title, quantity)")
    .eq("id", orderId)
    .single();
  if (error || !order) throw new Error(`order ${orderId} not found`);

  const { data: existing } = await admin
    .from("shipments")
    .select("id, consignment_id, tracking_code, normalized_status")
    .eq("order_id", orderId)
    .neq("normalized_status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return { shipmentId: existing.id, reused: true, trackingCode: existing.tracking_code, consignmentId: existing.consignment_id };

  const items = (order.order_items ?? []) as { product_title: string; quantity: number }[];
  const summary = items.map((i) => `${i.quantity}x ${i.product_title}`).join(", ").slice(0, 200);
  const payload = buildDispatchPayload(order, summary);

  const courier = getCourier();
  const result = await courier.createOrder(payload);

  let nextTransitionAt: string | null = null;
  if (isDemoMode()) {
    const speed = await getDemoSetting("courier_speed");
    nextTransitionAt = new Date(Date.now() + SPEED_STEP_SECONDS[speed] * 1000).toISOString();
  }

  const { data: shipment, error: shipErr } = await admin
    .from("shipments")
    .insert({
      order_id: orderId,
      courier_code: courier.code,
      consignment_id: result.consignmentId,
      tracking_code: result.trackingCode,
      invoice_ref: order.order_number,
      cod_amount_bdt: payload.codAmountBdt,
      status: result.status,
      normalized_status: "created",
      dispatched_at: new Date().toISOString(),
      raw_create_response: (result.raw ?? null) as never,
      next_transition_at: nextTransitionAt,
      note: (await getDemoSetting("force_return_next")) ? "demo:force_return" : null,
    })
    .select("id")
    .single();
  if (shipErr) throw new Error(`shipments insert failed: ${shipErr.message}`);

  if (isDemoMode() && (await getDemoSetting("force_return_next"))) await setDemoSetting("force_return_next", false);

  await admin.from("orders").update({ courier: courier.code, tracking_id: result.trackingCode, courier_response: (result.raw ?? null) as never }).eq("id", orderId);

  if (order.status !== "shipped") {
    await transitionOrder(orderId, "shipped", {
      actorType: opts.actorType ?? "system",
      actorId: opts.actorId ?? null,
      eventType: "dispatched",
      note: `Dispatched via ${courier.name}: ${result.trackingCode}`,
      metadata: { consignment_id: result.consignmentId, tracking_code: result.trackingCode },
    });
  }

  return { shipmentId: shipment.id, reused: false, trackingCode: result.trackingCode, consignmentId: result.consignmentId };
}
