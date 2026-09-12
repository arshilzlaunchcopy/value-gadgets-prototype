"use server";

import { z } from "zod";
import type { TimelineEvent } from "@/components/store/order-timeline";
import { isOrderNumber } from "@/lib/orders/number";
import { isValidBDPhone, toE164BD } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";

export interface TrackedOrder {
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total_bdt: number;
  placed_at: string;
  courier: string | null;
  tracking_id: string | null;
  shipment_status: string | null;
  district: string;
  items: { product_title: string; quantity: number }[];
  events: TimelineEvent[];
}

/** Public tracking: phone + order number, no login (BUILD_PROMPT §6.1). */
export async function trackOrderAction(phoneRaw: string, numberRaw: string): Promise<{ ok: true; order: TrackedOrder } | { ok: false; error: string }> {
  const phone = z.string().trim().safeParse(phoneRaw);
  const number = z.string().trim().toUpperCase().safeParse(numberRaw);
  if (!phone.success || !isValidBDPhone(phone.data)) return { ok: false, error: "Enter the mobile number used for the order" };
  if (!number.success || !isOrderNumber(number.data)) return { ok: false, error: "Order numbers look like VGBD-260912-AB12" };

  const { data: o } = await createAdminClient()
    .from("orders")
    .select("order_number, status, payment_status, payment_method, total_bdt, placed_at, courier, tracking_id, shipping_address, customer_phone, order_items(product_title, quantity), order_events(event_type, to_status, note, created_at), shipments(normalized_status, created_at)")
    .eq("order_number", number.data)
    .maybeSingle();
  if (!o || o.customer_phone !== toE164BD(phone.data)) return { ok: false, error: "No order found for that number and phone" };

  const ships = [...(o.shipments ?? [])].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return {
    ok: true,
    order: {
      order_number: o.order_number,
      status: o.status,
      payment_status: o.payment_status,
      payment_method: o.payment_method,
      total_bdt: o.total_bdt,
      placed_at: o.placed_at,
      courier: o.courier,
      tracking_id: o.tracking_id,
      shipment_status: ships[0]?.normalized_status ?? null,
      district: ((o.shipping_address ?? {}) as { district?: string }).district ?? "",
      items: o.order_items ?? [],
      events: [...(o.order_events ?? [])].sort((a, b) => (a.created_at < b.created_at ? -1 : 1)),
    },
  };
}
