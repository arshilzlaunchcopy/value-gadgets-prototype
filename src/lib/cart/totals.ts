import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCartSummary } from "./queries";
import type { CartLine, CouponResult, ShippingQuote, Totals } from "./types";

/**
 * Every price calculation happens here, server-side, from the database
 * (CLAUDE.md rule 4). Integers only.
 */

interface ZoneRow {
  name: string;
  districts: string[];
  rate_bdt: number;
  free_above_bdt: number | null;
  estimated_days: string | null;
}

async function loadZones(): Promise<ZoneRow[]> {
  const { data } = await createAdminClient()
    .from("shipping_zones")
    .select("name, districts, shipping_rates(rate_bdt, free_above_bdt, estimated_days, position)")
    .eq("is_active", true);
  return (data ?? [])
    .map((z) => {
      const rates = [...((z.shipping_rates ?? []) as { rate_bdt: number; free_above_bdt: number | null; estimated_days: string | null; position: number }[])].sort((a, b) => a.position - b.position);
      const r = rates[0];
      return r ? { name: z.name, districts: z.districts ?? [], rate_bdt: r.rate_bdt, free_above_bdt: r.free_above_bdt, estimated_days: r.estimated_days } : null;
    })
    .filter((z): z is ZoneRow => z !== null);
}

/** Zone match by district; the zone with no districts is the catch-all. */
export function pickZone(zones: ZoneRow[], district: string | null | undefined): ZoneRow | null {
  if (zones.length === 0) return null;
  if (district) {
    const d = district.trim().toLowerCase();
    const hit = zones.find((z) => z.districts.some((x) => x.toLowerCase() === d));
    if (hit) return hit;
  }
  return zones.find((z) => z.districts.length === 0) ?? null;
}

export function quoteShipping(zone: ZoneRow | null, subtotal: number, freeShipping = false): ShippingQuote | null {
  if (!zone) return null;
  const free = freeShipping || (zone.free_above_bdt !== null && subtotal >= zone.free_above_bdt);
  return { zone: zone.name, rate_bdt: zone.rate_bdt, free_above_bdt: zone.free_above_bdt, estimated_days: zone.estimated_days, charge_bdt: free ? 0 : zone.rate_bdt };
}

export async function getShippingQuote(district: string | null | undefined, subtotal: number, freeShipping = false): Promise<ShippingQuote | null> {
  return quoteShipping(pickZone(await loadZones(), district), subtotal, freeShipping);
}

// ------------------------------------------------------------------ coupons

interface AppliesTo {
  all?: boolean;
  product_ids?: string[];
  category_ids?: string[];
}

export async function validateCoupon(code: string, lines: CartLine[], customerId: string | null): Promise<CouponResult> {
  const admin = createAdminClient();
  const trimmed = code.trim().toUpperCase();
  const fail = (message: string): CouponResult => ({ code: trimmed, valid: false, message, discount_bdt: 0, free_shipping: false, coupon_id: null });
  if (!trimmed) return fail("Enter a coupon code");

  const { data: c } = await admin.from("coupons").select("*").eq("code", trimmed).maybeSingle();
  if (!c || !c.is_active) return fail("This coupon is not valid");
  const now = Date.now();
  if (c.starts_at && new Date(c.starts_at).getTime() > now) return fail("This coupon is not active yet");
  if (c.ends_at && new Date(c.ends_at).getTime() < now) return fail("This coupon has expired");
  if (c.usage_limit !== null && c.times_used >= c.usage_limit) return fail("This coupon has been fully redeemed");
  if (customerId && c.usage_limit_per_customer > 0) {
    const { count } = await admin.from("coupon_redemptions").select("id", { count: "exact", head: true }).eq("coupon_id", c.id).eq("customer_id", customerId);
    if ((count ?? 0) >= c.usage_limit_per_customer) return fail("You have already used this coupon");
  }

  const subtotal = lines.reduce((n, l) => n + l.line_total_bdt, 0);
  if (subtotal < c.min_order_bdt) return fail(`Minimum order for this coupon is ৳${c.min_order_bdt.toLocaleString("en-IN")}`);

  // eligible subtotal per applies_to
  const applies = (c.applies_to ?? { all: true }) as AppliesTo;
  let eligible = subtotal;
  if (!applies.all) {
    let ids = new Set<string>(applies.product_ids ?? []);
    if (applies.category_ids?.length) {
      const { data } = await admin.from("product_categories").select("product_id").in("category_id", applies.category_ids);
      ids = new Set([...ids, ...(data ?? []).map((r) => r.product_id)]);
    }
    eligible = lines.filter((l) => ids.has(l.product_id)).reduce((n, l) => n + l.line_total_bdt, 0);
    if (eligible === 0) return fail("This coupon does not apply to the items in your cart");
  }

  let discount = 0;
  let freeShipping = false;
  if (c.type === "percentage") discount = Math.floor((eligible * c.value) / 100);
  else if (c.type === "fixed") discount = Math.min(c.value, eligible);
  else freeShipping = true;
  if (c.max_discount_bdt !== null) discount = Math.min(discount, c.max_discount_bdt);
  discount = Math.max(0, Math.min(discount, subtotal));

  const message = freeShipping ? "Free delivery applied" : `৳${discount.toLocaleString("en-IN")} off applied`;
  return { code: trimmed, valid: true, message, discount_bdt: discount, free_shipping: freeShipping, coupon_id: c.id };
}

// ------------------------------------------------------------------- totals

export interface TotalsOptions {
  district?: string | null;
  couponCode?: string | null;
  customerId?: string | null;
}

export async function computeTotals(cartId: string | null, opts: TotalsOptions = {}): Promise<Totals> {
  const cart = await getCartSummary(cartId);
  const subtotal = cart.subtotal_bdt;
  const code = opts.couponCode ?? cart.coupon_code;
  const coupon = code && cart.items.length ? await validateCoupon(code, cart.items, opts.customerId ?? null) : null;
  const discount = coupon?.valid ? coupon.discount_bdt : 0;
  const shipping = opts.district ? await getShippingQuote(opts.district, subtotal - discount, coupon?.valid ? coupon.free_shipping : false) : null;
  const shippingBdt = shipping ? shipping.charge_bdt : null;
  return {
    lines: cart.items,
    subtotal_bdt: subtotal,
    discount_bdt: discount,
    shipping_bdt: shippingBdt,
    total_bdt: Math.max(0, subtotal - discount + (shippingBdt ?? 0)),
    coupon,
    shipping,
  };
}
