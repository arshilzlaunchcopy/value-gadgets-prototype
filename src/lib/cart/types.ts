/** Client-safe cart shapes (no server imports). Money is integer BDT. */
export interface CartLine {
  id: string; // cart_items.id
  variant_id: string;
  product_id: string;
  slug: string;
  title: string;
  variant_label: string | null;
  sku: string;
  unit_price_bdt: number;
  compare_at_bdt: number | null;
  quantity: number;
  line_total_bdt: number;
  available_qty: number;
  image: { src: string; alt: string } | null;
}

export interface CartSummary {
  id: string;
  items: CartLine[];
  count: number;
  subtotal_bdt: number;
  coupon_code: string | null;
}

export const EMPTY_CART: CartSummary = { id: "", items: [], count: 0, subtotal_bdt: 0, coupon_code: null };

export interface CartActionResult {
  ok: boolean;
  message?: string;
  cart: CartSummary;
}

export interface CouponResult {
  code: string;
  valid: boolean;
  message: string;
  discount_bdt: number;
  free_shipping: boolean;
  coupon_id: string | null;
}

export interface ShippingQuote {
  zone: string;
  rate_bdt: number;
  free_above_bdt: number | null;
  estimated_days: string | null;
  /** rate after the free-above rule */
  charge_bdt: number;
}

export interface Totals {
  lines: CartLine[];
  subtotal_bdt: number;
  discount_bdt: number;
  /** null when the district is not known yet */
  shipping_bdt: number | null;
  total_bdt: number;
  coupon: CouponResult | null;
  shipping: ShippingQuote | null;
}
