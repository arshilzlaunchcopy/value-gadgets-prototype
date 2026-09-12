/**
 * Pure discount preview for the admin coupon editor (BUILD_PROMPT §6.2 "live
 * preview of what the discount does to a sample cart"). Mirrors the rules in
 * src/lib/cart/totals.ts validateCoupon(); integers only.
 */
export interface PreviewCoupon {
  type: "percentage" | "fixed" | "free_shipping";
  value: number;
  min_order_bdt: number;
  max_discount_bdt: number | null;
  applies_all: boolean;
  eligible_product_ids?: string[];
}

export interface PreviewLine {
  product_id: string;
  title: string;
  unit_price_bdt: number;
  quantity: number;
}

export interface PreviewResult {
  ok: boolean;
  message: string;
  subtotal_bdt: number;
  eligible_bdt: number;
  discount_bdt: number;
  shipping_bdt: number;
  total_bdt: number;
}

export function previewCoupon(c: PreviewCoupon, lines: PreviewLine[], shippingBdt: number): PreviewResult {
  const subtotal = lines.reduce((n, l) => n + l.unit_price_bdt * l.quantity, 0);
  const base = { subtotal_bdt: subtotal, eligible_bdt: subtotal, discount_bdt: 0, shipping_bdt: shippingBdt, total_bdt: subtotal + shippingBdt };
  if (subtotal < c.min_order_bdt) return { ok: false, message: `Minimum order is ৳${c.min_order_bdt.toLocaleString("en-IN")}`, ...base };
  let eligible = subtotal;
  if (!c.applies_all) {
    const ids = new Set(c.eligible_product_ids ?? []);
    eligible = lines.filter((l) => ids.has(l.product_id)).reduce((n, l) => n + l.unit_price_bdt * l.quantity, 0);
    if (eligible === 0) return { ok: false, message: "No eligible items in this cart", ...base };
  }
  let discount = 0;
  let shipping = shippingBdt;
  if (c.type === "percentage") discount = Math.floor((eligible * c.value) / 100);
  else if (c.type === "fixed") discount = Math.min(c.value, eligible);
  else shipping = 0;
  if (c.max_discount_bdt !== null) discount = Math.min(discount, c.max_discount_bdt);
  discount = Math.max(0, Math.min(discount, subtotal));
  const total = Math.max(0, subtotal - discount + shipping);
  return { ok: true, message: c.type === "free_shipping" ? "Free delivery applied" : `৳${discount.toLocaleString("en-IN")} off`, subtotal_bdt: subtotal, eligible_bdt: eligible, discount_bdt: discount, shipping_bdt: shipping, total_bdt: total };
}
