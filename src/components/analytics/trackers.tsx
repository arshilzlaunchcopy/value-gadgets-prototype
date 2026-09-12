"use client";

import { useEffect } from "react";
import { trackBeginCheckout, trackPurchase, trackViewItem, type EventItem } from "@/lib/analytics/events";

export function TrackViewItem({ item }: { item: EventItem }) {
  useEffect(() => trackViewItem(item), [item]);
  return null;
}

export function TrackBeginCheckout({ items }: { items: EventItem[] }) {
  useEffect(() => {
    if (items.length) trackBeginCheckout(items);
  }, [items]);
  return null;
}

/** Fires once per order per browser (sessionStorage guard) with event_id = order id. */
export function TrackPurchase({ order }: { order: { id: string; number: string; total_bdt: number; shipping_bdt: number; items: EventItem[] } }) {
  useEffect(() => {
    const key = `vg_purchase_${order.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    trackPurchase(order);
  }, [order]);
  return null;
}
