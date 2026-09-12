import "server-only";

import type { Tables } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

export type OrderStatus = Tables<"orders">["status"];

export const ORDER_STATUSES: OrderStatus[] = [
  "pending_payment",
  "awaiting_advance",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
  "refunded",
];

const TERMINAL: OrderStatus[] = ["delivered", "cancelled", "returned", "refunded"];

export function isTerminal(s: OrderStatus): boolean {
  return TERMINAL.includes(s);
}

export interface TransitionOptions {
  actorType?: "admin" | "customer" | "system";
  actorId?: string | null;
  note?: string;
  metadata?: Record<string, unknown>;
  eventType?: string;
  /** Skip the "already in that status" short-circuit and append an event anyway */
  force?: boolean;
}

/**
 * Single choke point for order status changes. Writes the timestamp column,
 * appends an order_events row, and keeps customers.total_* counters in sync.
 * Shared by the IPN handler, courier webhook, demo panel and seed engine.
 */
export async function transitionOrder(orderId: string, to: OrderStatus, opts: TransitionOptions = {}) {
  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("orders")
    .select("id, status, payment_method, payment_status, customer_id")
    .eq("id", orderId)
    .single();
  if (error || !order) throw new Error(`order ${orderId} not found`);
  const from = order.status;
  if (from === to && !opts.force) return { changed: false, from, to };

  const now = new Date().toISOString();
  const patch: Partial<Tables<"orders">> = { status: to };
  if (to === "confirmed") patch.confirmed_at = now;
  if (to === "shipped") patch.shipped_at = now;
  if (to === "delivered") {
    patch.delivered_at = now;
    if (order.payment_method === "cod" && order.payment_status === "unpaid") patch.payment_status = "paid";
  }
  if (to === "cancelled") patch.cancelled_at = now;
  if (to === "refunded") patch.payment_status = "refunded";

  const { error: upErr } = await admin.from("orders").update(patch).eq("id", orderId);
  if (upErr) throw new Error(`order update failed: ${upErr.message}`);

  await admin.from("order_events").insert({
    order_id: orderId,
    event_type: opts.eventType ?? "status_changed",
    from_status: from,
    to_status: to,
    actor_type: opts.actorType ?? "system",
    actor_id: opts.actorId ?? null,
    note: opts.note ?? null,
    metadata: (opts.metadata ?? null) as never,
  });

  if (order.customer_id) await bumpCustomerCounters(order.customer_id, from, to);
  return { changed: true, from, to };
}

async function bumpCustomerCounters(customerId: string, from: OrderStatus, to: OrderStatus) {
  const admin = createAdminClient();
  const { data: c } = await admin
    .from("customers")
    .select("total_delivered, total_cancelled, total_returned")
    .eq("id", customerId)
    .maybeSingle();
  if (!c) return;
  const patch: Partial<Tables<"customers">> = {};
  if (to === "delivered" && from !== "delivered") patch.total_delivered = c.total_delivered + 1;
  if (to === "cancelled" && from !== "cancelled") patch.total_cancelled = c.total_cancelled + 1;
  if (to === "returned" && from !== "returned") patch.total_returned = c.total_returned + 1;
  if (Object.keys(patch).length) await admin.from("customers").update(patch).eq("id", customerId);
}

export async function appendOrderEvent(orderId: string, eventType: string, opts: Omit<TransitionOptions, "eventType" | "force"> & { fromStatus?: OrderStatus | null; toStatus?: OrderStatus | null } = {}) {
  const admin = createAdminClient();
  await admin.from("order_events").insert({
    order_id: orderId,
    event_type: eventType,
    from_status: opts.fromStatus ?? null,
    to_status: opts.toStatus ?? null,
    actor_type: opts.actorType ?? "system",
    actor_id: opts.actorId ?? null,
    note: opts.note ?? null,
    metadata: (opts.metadata ?? null) as never,
  });
}
