import "server-only";

import { calculateFraudScore } from "@/lib/fraud/score";
import { mockCourierScore } from "@/lib/integrations/fraud/mock";
import { normalizeBD } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CatalogIds } from "./catalog";
import type { SeedCustomer } from "./customers";
import { PRODUCTS } from "./data/catalog";
import { UTM } from "./data/people";
import { Rng } from "./rng";

type OrderStatus = "pending_payment" | "confirmed" | "processing" | "packed" | "shipped" | "delivered" | "cancelled" | "returned";

export interface OrderGenOptions {
  count: number;
  daysBack: number;
  /** seed for the rng; SEED for the reproducible base set, Date.now() for on-demand extras */
  seed: number;
  /** campaign spike day offset (days ago); undefined = none */
  campaignDayAgo?: number;
  images: Map<string, string | null>;
}

const DAY = 86_400_000;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function orderNumber(rng: Rng, placedAt: Date): string {
  const yy = String(placedAt.getUTCFullYear()).slice(2);
  const mm = String(placedAt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(placedAt.getUTCDate()).padStart(2, "0");
  let s = "";
  for (let i = 0; i < 4; i++) s += CODE_CHARS[rng.int(0, CODE_CHARS.length - 1)];
  return `VGBD-${yy}${mm}${dd}-${s}`;
}

/** Day weight: weekends (Fri/Sat in BD) heavier, growth trend, campaign spike. */
function dayWeight(daysAgo: number, daysBack: number, campaignDayAgo?: number): number {
  const date = new Date(Date.now() - daysAgo * DAY);
  const dow = date.getUTCDay(); // 5 = Fri, 6 = Sat
  let w = dow === 5 || dow === 6 ? 1.5 : dow === 4 ? 1.15 : 1;
  w *= 1 + 0.35 * (1 - daysAgo / daysBack); // ~+35% over the period
  if (campaignDayAgo !== undefined) {
    const d = Math.abs(daysAgo - campaignDayAgo);
    if (d <= 2) w *= 3 - d * 0.7;
  }
  return w;
}

function shippingFor(district: string, subtotal: number): number {
  if (district === "Dhaka") return subtotal >= 2000 ? 0 : 60;
  if (["Gazipur", "Narayanganj", "Manikganj", "Munshiganj", "Narsingdi"].includes(district)) return subtotal >= 3000 ? 0 : 100;
  return 130;
}

/**
 * Generate + insert orders (with items, events, payments, shipments).
 * Deterministic for a given seed: ids and order numbers come from the rng, so
 * re-running with the same seed upserts the same rows.
 */
export async function generateOrderBatch(customers: SeedCustomer[], catalog: CatalogIds, opts: OrderGenOptions) {
  const admin = createAdminClient();
  const rng = new Rng(opts.seed ^ 0x0bde);
  const now = Date.now();

  const dayWeights = Array.from({ length: opts.daysBack }, (_, d) => [d, dayWeight(d, opts.daysBack, opts.campaignDayAgo)] as const);
  const customerWeights = customers.map((c) => [c, c.weight] as const);
  const productList = PRODUCTS.filter((p) => (catalog.variants.get(p.slug) ?? []).length > 0);
  // popularity: featured + cheaper items sell more
  const productWeights = productList.map((p) => [p, (p.featured ? 3 : 1) * (p.price < 1500 ? 1.6 : p.price < 4000 ? 1 : 0.6)] as const);

  const orders: Record<string, unknown>[] = [];
  const items: Record<string, unknown>[] = [];
  const events: Record<string, unknown>[] = [];
  const payments: Record<string, unknown>[] = [];
  const shipments: Record<string, unknown>[] = [];
  const usedNumbers = new Set<string>();

  for (let n = 0; n < opts.count; n++) {
    // status first (~70 delivered / 12 in transit / 8 processing / 6 returned / 4 cancelled),
    // then a date that makes sense for it: in-flight orders are always recent.
    let status: OrderStatus = rng.weighted([["delivered", 70], ["shipped", 12], ["processing", 8], ["returned", 6], ["cancelled", 4]] as const);
    // exactly 35% online / 65% COD (stratified, not sampled - keeps the split stable)
    const paymentMethod = (n * 7) % 20 < 7 ? "sslcommerz" : "cod";
    if (status === "processing") {
      if (paymentMethod === "sslcommerz" && rng.chance(0.35)) status = "pending_payment";
      else if (rng.chance(0.4)) status = rng.pick(["confirmed", "packed"] as const);
    }
    const maxDaysAgo = status === "pending_payment" ? 1 : status === "shipped" ? 5 : ["processing", "confirmed", "packed"].includes(status) ? 2 : opts.daysBack - 1;
    let daysAgo = rng.weighted(dayWeights);
    if (daysAgo > maxDaysAgo) daysAgo = rng.int(0, Math.min(maxDaysAgo, opts.daysBack - 1));
    // time of day: BD shoppers peak 20:00-23:00 local (UTC+6)
    const hourLocal = rng.weighted([[9, 2], [11, 3], [13, 4], [15, 4], [17, 5], [19, 7], [21, 10], [22, 9], [23, 6], [0, 3], [2, 1], [4, 0.5]] as const);
    const placedAt = new Date(now - daysAgo * DAY - ((24 - hourLocal + 6) % 24) * 3_600_000 - rng.int(0, 59) * 60_000);
    const customer = rng.weighted(customerWeights);
    const addr = customer.address;

    // items
    const lineCount = rng.weighted([[1, 62], [2, 26], [3, 9], [4, 3]] as const);
    const chosen = new Set<string>();
    let subtotal = 0;
    const orderId = rng.uuid();
    const lines: Record<string, unknown>[] = [];
    for (let i = 0; i < lineCount; i++) {
      const p = rng.weighted(productWeights);
      if (chosen.has(p.slug)) continue;
      chosen.add(p.slug);
      const variants = catalog.variants.get(p.slug)!;
      const v = rng.pick(variants);
      const qty = rng.weighted([[1, 80], [2, 15], [3, 5]] as const);
      const lineTotal = v.price_bdt * qty;
      subtotal += lineTotal;
      lines.push({
        id: rng.uuid(),
        order_id: orderId,
        variant_id: v.id,
        product_id: catalog.products.get(p.slug)!,
        product_title: p.title_en,
        variant_label: v.label,
        sku: v.sku,
        unit_price_bdt: v.price_bdt,
        quantity: qty,
        line_total_bdt: lineTotal,
        image_url: opts.images.get(p.slug) ?? null,
        created_at: placedAt.toISOString(),
      });
    }
    const shipping = shippingFor(addr.district, subtotal);
    const discount = rng.chance(0.12) ? Math.min(500, Math.round(subtotal * 0.1)) : 0;
    const total = subtotal - discount + shipping;

    // fraud
    const priorOrders = orders.filter((o) => o.customer_id === customer.id).length;
    const cs = mockCourierScore(customer.phone);
    const fraud = calculateFraudScore({
      paymentMethod,
      totalBdt: total,
      isFirstOrder: priorOrders === 0,
      priorOrders,
      priorCancelledOrReturned: 0,
      ordersFromIpLastHour: rng.chance(0.03) ? 3 : 1,
      phoneHasBlockedOrder: false,
      districtServiced: true,
      placedHour: hourLocal,
      courierScore: cs,
    });
    const nonTerminal = !["delivered", "returned", "cancelled"].includes(status);
    const needsReview = fraud.needsReview && nonTerminal;

    let num = orderNumber(rng, placedAt);
    while (usedNumbers.has(num)) num = orderNumber(rng, placedAt);
    usedNumbers.add(num);

    const utmSource = rng.chance(0.6) ? rng.weighted(UTM.sources) : null;
    const confirmedAt = status === "pending_payment" ? null : new Date(placedAt.getTime() + rng.int(10, 240) * 60_000);
    const shippedAt = ["shipped", "delivered", "returned"].includes(status) && confirmedAt ? new Date(confirmedAt.getTime() + rng.int(6, 36) * 3_600_000) : null;
    const deliveredAt = status === "delivered" && shippedAt ? new Date(shippedAt.getTime() + (addr.district === "Dhaka" ? rng.int(12, 40) : rng.int(48, 120)) * 3_600_000) : null;
    const cancelledAt = status === "cancelled" && confirmedAt ? new Date(confirmedAt.getTime() + rng.int(1, 48) * 3_600_000) : null;

    const paymentStatus = paymentMethod === "sslcommerz" ? (status === "pending_payment" ? "unpaid" : status === "cancelled" ? "failed" : "paid") : status === "delivered" ? "paid" : "unpaid";

    orders.push({
      id: orderId,
      order_number: num,
      customer_id: customer.id,
      status,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      subtotal_bdt: subtotal,
      discount_bdt: discount,
      shipping_bdt: shipping,
      total_bdt: total,
      coupon_code: discount ? "EID10" : null,
      shipping_address: { recipient_name: addr.recipient_name, phone: addr.phone, division: addr.division, district: addr.district, upazila: addr.upazila, area: addr.area, street_address: addr.street_address, landmark: addr.landmark },
      customer_phone: customer.phone,
      customer_name: customer.full_name,
      customer_email: customer.email,
      customer_note: rng.chance(0.15) ? rng.pick(["Please call before delivery", "Deliver after 5pm", "Gift wrap if possible", "Leave with the security guard"]) : null,
      fraud_score: fraud.score,
      fraud_flags: fraud.flags,
      needs_review: needsReview,
      is_phone_verified: true,
      courier: shippedAt ? "mock" : null,
      placed_at: placedAt.toISOString(),
      created_at: placedAt.toISOString(),
      confirmed_at: confirmedAt?.toISOString() ?? null,
      shipped_at: shippedAt?.toISOString() ?? null,
      delivered_at: deliveredAt?.toISOString() ?? null,
      cancelled_at: cancelledAt?.toISOString() ?? null,
      utm_source: utmSource,
      utm_medium: utmSource ? UTM.mediums[utmSource] : null,
      utm_campaign: utmSource ? rng.pick(UTM.campaigns) : null,
      landing_page: utmSource ? rng.pick(["/", "/products/ugreen-8-in-1-usb-c-hub", "/collections/eid-offers", "/lp/usb-c-hub-8in1"]) : null,
      referrer: utmSource ? `https://${utmSource}.com/` : null,
    });
    items.push(...lines);

    // events
    const ev = (type: string, from: string | null, to: string | null, at: Date, note?: string) =>
      events.push({ id: rng.uuid(), order_id: orderId, event_type: type, from_status: from, to_status: to, actor_type: "system", note: note ?? null, created_at: at.toISOString() });
    ev("placed", null, "pending_payment", placedAt, `Order placed (${paymentMethod})`);
    if (confirmedAt) ev("status_changed", "pending_payment", "confirmed", confirmedAt, paymentMethod === "sslcommerz" ? "Payment validated" : "COD auto-confirmed");
    if (shippedAt) ev("dispatched", "confirmed", "shipped", shippedAt, "Dispatched via mock courier");
    if (deliveredAt) ev("courier_status", "shipped", "delivered", deliveredAt, "mock: delivered");
    if (status === "returned" && shippedAt) ev("courier_status", "shipped", "returned", new Date(shippedAt.getTime() + rng.int(48, 96) * 3_600_000), "mock: returned (customer refused)");
    if (cancelledAt) ev("status_changed", "confirmed", "cancelled", cancelledAt, rng.pick(["Customer cancelled by phone", "Fraud review: cancelled", "Out of stock"]));
    if (needsReview) ev("fraud_flagged", null, null, placedAt, `Fraud score ${fraud.score}: ${fraud.flags.join(", ")}`);

    // payments
    if (paymentMethod === "sslcommerz") {
      const txnId = `MOCK-${num}-${rng.int(100, 999)}`;
      const ok = paymentStatus === "paid";
      payments.push({
        id: rng.uuid(),
        order_id: orderId,
        gateway: "mock",
        gateway_txn_id: txnId,
        val_id: ok ? `VAL-${rng.int(100000, 999999)}` : null,
        bank_txn_id: ok ? `BANK${placedAt.getTime()}` : null,
        amount_bdt: total,
        currency: "BDT",
        card_type: rng.weighted([["BKASH-BKash", 55], ["NAGAD-Nagad", 20], ["VISA-Dutch Bangla", 15], ["MASTER-BRAC", 10]] as const),
        status: ok ? "validated" : status === "cancelled" ? "failed" : "initiated",
        validated_at: ok && confirmedAt ? confirmedAt.toISOString() : null,
        raw_initiate_response: { seed: true },
        created_at: placedAt.toISOString(),
      });
    }

    // shipments
    if (shippedAt) {
      const normalized = status === "delivered" ? "delivered" : status === "returned" ? "returned" : rng.pick(["in_transit", "out_for_delivery"] as const);
      shipments.push({
        id: rng.uuid(),
        order_id: orderId,
        courier_code: "mock",
        consignment_id: `1${String(rng.int(0, 9_999_999)).padStart(7, "0")}`,
        tracking_code: `VG${Array.from({ length: 9 }, () => CODE_CHARS[rng.int(0, CODE_CHARS.length - 1)]).join("")}`,
        invoice_ref: num,
        cod_amount_bdt: paymentMethod === "cod" ? total : 0,
        delivery_charge_bdt: 60,
        status: normalized,
        normalized_status: normalized,
        dispatched_at: shippedAt.toISOString(),
        delivered_at: deliveredAt?.toISOString() ?? null,
        next_transition_at: normalized === "in_transit" || normalized === "out_for_delivery" ? new Date(now + 60_000).toISOString() : null,
        created_at: shippedAt.toISOString(),
      });
    }
  }

  // Review queue: keep 5-8 open items (BUILD_PROMPT_PART3 §21.2) for the base seed.
  if (opts.count >= 50) {
    const open = orders.filter((o) => !["delivered", "returned", "cancelled"].includes(o.status as string));
    const flagged = open.filter((o) => o.needs_review);
    if (flagged.length > 8) {
      for (const o of rng.shuffle(flagged).slice(8)) o.needs_review = false;
    } else if (flagged.length < 5) {
      const candidates = open.filter((o) => !o.needs_review).sort((a, b) => (b.fraud_score as number) - (a.fraud_score as number));
      for (const o of candidates.slice(0, 5 - flagged.length)) {
        o.needs_review = true;
        o.fraud_score = Math.max(o.fraud_score as number, 35);
        (o.fraud_flags as string[]).push("manual review sample (+35)");
      }
    }
  }

  // write in chunks; upsert keeps re-runs idempotent
  const chunk = async (table: "orders" | "order_items" | "order_events" | "payment_transactions" | "shipments", rows: Record<string, unknown>[], conflict = "id") => {
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await admin.from(table).upsert(rows.slice(i, i + 200) as never, { onConflict: conflict });
      if (error) throw new Error(`seed ${table}: ${error.message}`);
    }
  };
  await chunk("orders", orders, "order_number");
  // items/events for re-seeded orders are replaced wholesale to avoid drift
  const orderIds = orders.map((o) => o.id as string);
  for (let i = 0; i < orderIds.length; i += 200) {
    const ids = orderIds.slice(i, i + 200);
    await admin.from("order_items").delete().in("order_id", ids);
    await admin.from("order_events").delete().in("order_id", ids);
    await admin.from("shipments").delete().in("order_id", ids);
    await admin.from("payment_transactions").delete().in("order_id", ids);
  }
  await chunk("order_items", items);
  await chunk("order_events", events);
  await chunk("payment_transactions", payments);
  await chunk("shipments", shipments);

  console.log(`[seed] orders: ${orders.length} (${items.length} items, ${payments.length} payments, ${shipments.length} shipments)`);
  return { orderIds, count: orders.length };
}

/** Recompute customers.total_* from orders. */
export async function refreshCustomerCounters(): Promise<void> {
  const admin = createAdminClient();
  const { data: rows, error } = await admin.from("orders").select("customer_id, status");
  if (error) throw new Error(error.message);
  const agg = new Map<string, { o: number; d: number; c: number; r: number }>();
  for (const r of rows ?? []) {
    if (!r.customer_id) continue;
    const a = agg.get(r.customer_id) ?? { o: 0, d: 0, c: 0, r: 0 };
    a.o++;
    if (r.status === "delivered") a.d++;
    if (r.status === "cancelled") a.c++;
    if (r.status === "returned") a.r++;
    agg.set(r.customer_id, a);
  }
  for (const [id, a] of agg) {
    await admin.from("customers").update({ total_orders: a.o, total_delivered: a.d, total_cancelled: a.c, total_returned: a.r }).eq("id", id);
  }
}

/** Some phones never verify. Keeps fraud flags plausible for the review queue. */
export function phoneLocal(phone: string): string {
  return normalizeBD(phone) ?? phone;
}
