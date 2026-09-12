"use client";

/**
 * Browser-side ecommerce events (BUILD_PROMPT §7.8): GA4 recommended events +
 * Meta Pixel standard events. Safe no-ops until the tags are loaded.
 */
export interface EventItem {
  id: string;
  name: string;
  price_bdt: number;
  quantity?: number;
  variant?: string | null;
  brand?: string | null;
}

type Fbq = (...args: unknown[]) => void;
type Gtag = (...args: unknown[]) => void;

function w(): { fbq?: Fbq; gtag?: Gtag } {
  return typeof window === "undefined" ? {} : (window as unknown as { fbq?: Fbq; gtag?: Gtag });
}

const ga4Items = (items: EventItem[]) => items.map((i) => ({ item_id: i.id, item_name: i.name, price: i.price_bdt, quantity: i.quantity ?? 1, item_variant: i.variant ?? undefined, item_brand: i.brand ?? undefined }));
const fbContents = (items: EventItem[]) => items.map((i) => ({ id: i.id, quantity: i.quantity ?? 1, item_price: i.price_bdt }));
const value = (items: EventItem[]) => items.reduce((n, i) => n + i.price_bdt * (i.quantity ?? 1), 0);

export function trackViewItem(item: EventItem) {
  const { fbq, gtag } = w();
  try {
    gtag?.("event", "view_item", { currency: "BDT", value: item.price_bdt, items: ga4Items([item]) });
    fbq?.("track", "ViewContent", { content_ids: [item.id], content_type: "product", content_name: item.name, currency: "BDT", value: item.price_bdt });
  } catch {}
}

export function trackAddToCart(item: EventItem) {
  const { fbq, gtag } = w();
  try {
    gtag?.("event", "add_to_cart", { currency: "BDT", value: value([item]), items: ga4Items([item]) });
    fbq?.("track", "AddToCart", { content_ids: [item.id], content_type: "product", contents: fbContents([item]), currency: "BDT", value: value([item]) });
  } catch {}
}

export function trackBeginCheckout(items: EventItem[]) {
  const { fbq, gtag } = w();
  try {
    gtag?.("event", "begin_checkout", { currency: "BDT", value: value(items), items: ga4Items(items) });
    fbq?.("track", "InitiateCheckout", { content_ids: items.map((i) => i.id), contents: fbContents(items), currency: "BDT", value: value(items), num_items: items.length });
  } catch {}
}

/** Purchase with event_id = order id so the server-side CAPI event deduplicates (§7.8). */
export function trackPurchase(order: { id: string; number: string; total_bdt: number; shipping_bdt: number; items: EventItem[] }) {
  const { fbq, gtag } = w();
  try {
    gtag?.("event", "purchase", { transaction_id: order.number, currency: "BDT", value: order.total_bdt, shipping: order.shipping_bdt, items: ga4Items(order.items) });
    fbq?.("track", "Purchase", { content_ids: order.items.map((i) => i.id), content_type: "product", contents: fbContents(order.items), currency: "BDT", value: order.total_bdt, order_id: order.number }, { eventID: order.id });
  } catch {}
}
