import "server-only";

import { getCartSummary } from "@/lib/cart/queries";
import { releaseCart } from "@/lib/cart/reservations";
import { computeTotals } from "@/lib/cart/totals";
import { getDemoSetting, setDemoSetting } from "@/lib/demo/settings";
import { isDemoMode } from "@/lib/env";
import { getCachedCourierScore } from "@/lib/fraud/courier-score";
import { calculateFraudScore, FRAUD_THRESHOLDS } from "@/lib/fraud/score";
import { getPayment } from "@/lib/integrations/payment";
import { getSms } from "@/lib/integrations/sms";
import { toE164BD } from "@/lib/phone";
import { renderSms } from "@/lib/sms/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateOrderNumber } from "./number";
import { appendOrderEvent } from "./status";

export interface ShippingAddressInput {
  recipient_name: string;
  phone: string;
  division: string;
  district: string;
  upazila: string;
  area?: string;
  street_address: string;
  postcode?: string;
  landmark?: string;
}

export interface PlaceOrderInput {
  cartId: string;
  customer: { id: string; phone: string; full_name?: string | null; email?: string | null };
  address: ShippingAddressInput;
  paymentMethod: "cod" | "sslcommerz";
  couponCode?: string | null;
  customerNote?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null; landing_page?: string | null; referrer?: string | null };
}

export interface PlaceOrderResult {
  orderId: string;
  orderNumber: string;
  status: string;
  paymentMethod: "cod" | "sslcommerz";
  totalBdt: number;
  /** online payments: send the browser here */
  redirectUrl?: string;
}

export class OrderError extends Error {
  constructor(
    message: string,
    public readonly code: "EMPTY_CART" | "OUT_OF_STOCK" | "BLOCKED" | "INVALID",
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "OrderError";
  }
}

function dhakaHour(date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "numeric", hour12: false }).format(date));
}

async function thresholds(): Promise<{ review: number; advance: number }> {
  const { data } = await createAdminClient().from("settings").select("value").eq("key", "fraud_thresholds").maybeSingle();
  const v = (data?.value as { review?: number; advance?: number } | null) ?? {};
  return { review: v.review ?? FRAUD_THRESHOLDS.review, advance: v.advance ?? FRAUD_THRESHOLDS.advance };
}

/**
 * Order placement (BUILD_PROMPT §9.1, PART2 §14.3). Everything is recomputed
 * from the database: the client only ever sent variant ids and quantities.
 * order_items are SNAPSHOTS (CLAUDE.md rule 5).
 */
export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const admin = createAdminClient();
  const phone = toE164BD(input.customer.phone);
  if (!phone) throw new OrderError("Invalid phone", "INVALID");

  const { data: customer } = await admin.from("customers").select("id, phone, full_name, email, is_blocked, total_orders, total_cancelled, total_returned").eq("id", input.customer.id).single();
  if (!customer) throw new OrderError("Customer not found", "INVALID");
  if (customer.is_blocked) throw new OrderError("This account cannot place orders. Please contact support.", "BLOCKED");

  // 1. totals from the DB
  const totals = await computeTotals(input.cartId, { district: input.address.district, couponCode: input.couponCode ?? null, customerId: customer.id });
  if (totals.lines.length === 0) throw new OrderError("Your cart is empty", "EMPTY_CART");
  if (totals.shipping_bdt === null) throw new OrderError("Could not determine delivery charge for this district", "INVALID");
  const short = totals.lines.filter((l) => l.available_qty < l.quantity);
  if (short.length) throw new OrderError("Some items are no longer available in the requested quantity", "OUT_OF_STOCK", short.map((l) => ({ title: l.title, available: l.available_qty })));
  if (input.couponCode && totals.coupon && !totals.coupon.valid) throw new OrderError(totals.coupon.message, "INVALID");

  // 2. fraud score
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const [{ count: ipCount }, { count: blockedCount }, courier] = await Promise.all([
    input.ip ? admin.from("orders").select("id", { count: "exact", head: true }).eq("ip", input.ip).gte("placed_at", hourAgo) : Promise.resolve({ count: 0 }),
    admin.from("orders").select("id", { count: "exact", head: true }).eq("customer_phone", phone).eq("status", "cancelled").not("admin_note", "is", null).ilike("admin_note", "%fraud%"),
    getCachedCourierScore(phone),
  ]);
  const fraud = calculateFraudScore({
    paymentMethod: input.paymentMethod,
    totalBdt: totals.total_bdt,
    isFirstOrder: customer.total_orders === 0,
    priorOrders: customer.total_orders,
    priorCancelledOrReturned: customer.total_cancelled + customer.total_returned,
    ordersFromIpLastHour: (ipCount ?? 0) + 1,
    phoneHasBlockedOrder: (blockedCount ?? 0) > 0,
    districtServiced: true,
    placedHour: dhakaHour(),
    courierScore: courier.score,
    courierScoreUnavailable: courier.unavailable,
  });
  let score = fraud.score;
  const flags = [...fraud.flags];
  if (isDemoMode()) {
    const override = await getDemoSetting("fraud_score_override");
    if (override !== null && override !== undefined) {
      score = Math.max(0, Math.min(100, Number(override)));
      flags.push(`demo override (${score})`);
      await setDemoSetting("fraud_score_override", null);
    }
  }
  const t = await thresholds();
  const needsReview = score >= t.review;
  const needsAdvance = score >= t.advance;
  const status = input.paymentMethod === "sslcommerz" ? "pending_payment" : needsAdvance ? "awaiting_advance" : "confirmed";

  // 3. insert order with a unique number (retry on collision)
  const shippingAddress = {
    recipient_name: input.address.recipient_name.trim(),
    phone: input.address.phone.trim(),
    division: input.address.division,
    district: input.address.district,
    upazila: input.address.upazila,
    area: input.address.area?.trim() ?? "",
    street_address: input.address.street_address.trim(),
    postcode: input.address.postcode?.trim() ?? "",
    landmark: input.address.landmark?.trim() ?? "",
  };
  const now = new Date().toISOString();
  let orderId: string | null = null;
  let orderNumber = "";
  for (let attempt = 0; attempt < 4 && !orderId; attempt++) {
    orderNumber = generateOrderNumber();
    const { data, error } = await admin
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_id: customer.id,
        status,
        payment_method: input.paymentMethod,
        payment_status: "unpaid",
        subtotal_bdt: totals.subtotal_bdt,
        discount_bdt: totals.discount_bdt,
        shipping_bdt: totals.shipping_bdt,
        total_bdt: totals.total_bdt,
        coupon_code: totals.coupon?.valid ? totals.coupon.code : null,
        coupon_id: totals.coupon?.valid ? totals.coupon.coupon_id : null,
        shipping_address: shippingAddress as never,
        customer_phone: phone,
        customer_name: customer.full_name ?? shippingAddress.recipient_name,
        customer_email: customer.email,
        customer_note: input.customerNote?.trim() || null,
        fraud_score: score,
        fraud_flags: flags as never,
        needs_review: needsReview,
        is_phone_verified: true,
        placed_at: now,
        confirmed_at: status === "confirmed" ? now : null,
        utm_source: input.utm?.source ?? null,
        utm_medium: input.utm?.medium ?? null,
        utm_campaign: input.utm?.campaign ?? null,
        landing_page: input.utm?.landing_page ?? null,
        referrer: input.utm?.referrer ?? null,
        ip: input.ip ?? null,
      })
      .select("id")
      .single();
    if (!error) orderId = data.id;
    else if (error.code !== "23505") throw new Error(`order insert failed: ${error.message}`);
  }
  if (!orderId) throw new Error("could not allocate an order number");

  // 4. snapshot items
  const { error: itemsErr } = await admin.from("order_items").insert(
    totals.lines.map((l) => ({
      order_id: orderId!,
      variant_id: l.variant_id,
      product_id: l.product_id,
      product_title: l.title,
      variant_label: l.variant_label,
      sku: l.sku,
      unit_price_bdt: l.unit_price_bdt,
      quantity: l.quantity,
      line_total_bdt: l.line_total_bdt,
      image_url: l.image?.src ?? null,
    })),
  );
  if (itemsErr) throw new Error(`order_items insert failed: ${itemsErr.message}`);

  // 5. stock, coupon, counters, address, cart
  for (const l of totals.lines) {
    const { error } = await admin.rpc("adjust_stock", { p_variant: l.variant_id, p_delta: -l.quantity, p_reason: "order", p_order: orderId, p_note: orderNumber });
    if (error) throw new Error(`stock adjust failed: ${error.message}`);
  }
  if (totals.coupon?.valid && totals.coupon.coupon_id) {
    await admin.from("coupon_redemptions").insert({ coupon_id: totals.coupon.coupon_id, order_id: orderId, customer_id: customer.id, discount_bdt: totals.discount_bdt });
    await admin.rpc("increment_coupon_usage", { p_coupon: totals.coupon.coupon_id });
  }
  await admin.rpc("increment_customer_orders", { p_customer: customer.id });
  await saveAddress(customer.id, shippingAddress);
  await releaseCart(input.cartId);
  await admin.from("cart_items").delete().eq("cart_id", input.cartId);
  await admin.from("carts").update({ coupon_code: null, customer_id: customer.id }).eq("id", input.cartId);

  // 6. events
  await appendOrderEvent(orderId, "placed", { actorType: "customer", actorId: customer.id, note: `Placed via ${input.paymentMethod === "cod" ? "cash on delivery" : "online payment"}`, metadata: { total_bdt: totals.total_bdt } });
  if (status === "confirmed") await appendOrderEvent(orderId, "status_changed", { note: "COD auto-confirmed", metadata: { from: "pending_payment", to: "confirmed", fraud_score: score } });
  if (needsReview) await appendOrderEvent(orderId, "fraud_flagged", { note: `Fraud score ${score}: ${flags.join(", ")}`, metadata: { score, needs_advance: needsAdvance } });

  // 7. notify / payment session
  let redirectUrl: string | undefined;
  if (input.paymentMethod === "cod") {
    if (status === "confirmed") await notifyConfirmed(orderId, orderNumber, totals.total_bdt, phone);
  } else {
    const { data: order } = await admin.from("orders").select("*").eq("id", orderId).single();
    if (order) {
      const session = await getPayment().createSession(order);
      redirectUrl = session.redirectUrl;
      await appendOrderEvent(orderId, "payment_initiated", { note: `Gateway session ${session.txnId}` });
    }
  }
  return { orderId, orderNumber, status, paymentMethod: input.paymentMethod, totalBdt: totals.total_bdt, redirectUrl };
}

export async function notifyConfirmed(orderId: string, orderNumber: string, totalBdt: number, phone: string): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/track?order=${orderNumber}`;
  const message = await renderSms("order_confirmed", { order_number: orderNumber, total: totalBdt.toLocaleString("en-IN"), url });
  const r = await getSms().send(phone, message, "order_confirmed");
  await appendOrderEvent(orderId, r.ok ? "sms_sent" : "sms_failed", { note: r.ok ? "Order confirmation SMS sent" : `SMS failed: ${r.error}`, metadata: { kind: "order_confirmed" } });
}

async function saveAddress(customerId: string, a: Required<ShippingAddressInput>): Promise<void> {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("addresses").select("id, street_address, district, is_default").eq("customer_id", customerId);
  const same = (existing ?? []).find((e) => e.street_address === a.street_address && e.district === a.district);
  if (same) return;
  const isDefault = (existing ?? []).length === 0;
  await admin.from("addresses").insert({ customer_id: customerId, ...a, is_default: isDefault });
}

/** Cart lines are re-read for the confirmation screen; kept here so callers stay thin. */
export async function cartIsEmpty(cartId: string | null): Promise<boolean> {
  return (await getCartSummary(cartId)).items.length === 0;
}
