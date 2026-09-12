import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureCustomerForPhone } from "@/lib/auth/identity";
import { BLOCKED_DEMO_PHONE, KNOWN_PHONES } from "@/lib/demo/known-phones";
import { OrderError, placeOrder, type PlaceOrderInput } from "@/lib/orders/create";
import { processCourierWebhook } from "@/lib/courier/webhook";
import { toE164BD } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Phase 12 order path against the demo DB: blocked entities refuse checkout,
 * clean COD auto-confirms AND auto-dispatches, risky phones wait in the review
 * queue, flagged phones need an advance + phone re-verification, and a
 * courier "returned" restocks the items.
 */
describe("placeOrder fraud + dispatch flow (PART2 §14.3)", () => {
  const admin = createAdminClient();
  const tag = randomBytes(4).toString("hex");
  const orderIds: string[] = [];
  const cartIds: string[] = [];
  const createdCustomers: string[] = [];
  let productId: string;
  let variantId: string;

  const trusted = KNOWN_PHONES.find((k) => k.label.startsWith("Excellent"))!.phone;
  const risky = KNOWN_PHONES.find((k) => k.bucket === "risky")!.phone;
  const flagged = KNOWN_PHONES.find((k) => k.bucket === "flagged")!.phone;

  beforeAll(async () => {
    const { data: p } = await admin.from("products").insert({ slug: `__p12-${tag}`, title_en: "Phase 12 test product", status: "active", published_at: new Date().toISOString() }).select("id").single();
    productId = p!.id;
    const { data: v } = await admin.from("product_variants").insert({ product_id: productId, sku: `P12-${tag}`, price_bdt: 500, stock_qty: 20, is_default: true }).select("id").single();
    variantId = v!.id;
    await admin.from("demo_settings").upsert({ key: "fraud_score_override", value: null as never }, { onConflict: "key" });
    await admin.from("demo_settings").upsert({ key: "courier_outage", value: false as never }, { onConflict: "key" });
  });

  afterAll(async () => {
    if (orderIds.length) await admin.from("orders").delete().in("id", orderIds);
    if (cartIds.length) await admin.from("carts").delete().in("id", cartIds);
    await admin.from("products").delete().eq("id", productId);
    for (const id of createdCustomers) await admin.auth.admin.deleteUser(id).catch(() => undefined);
  });

  async function customerFor(phone: string) {
    const { id, created } = await ensureCustomerForPhone(phone);
    if (created) createdCustomers.push(id);
    const { data } = await admin.from("customers").select("id, phone, full_name, email").eq("id", id).single();
    return data!;
  }

  async function cartWith(qty: number) {
    const { data: c } = await admin.from("carts").insert({ session_token: `p12-${tag}-${cartIds.length}` }).select("id").single();
    cartIds.push(c!.id);
    await admin.from("cart_items").insert({ cart_id: c!.id, variant_id: variantId, quantity: qty });
    return c!.id;
  }

  const input = (cartId: string, customer: Awaited<ReturnType<typeof customerFor>>, overrides: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({
    cartId,
    customer: { id: customer.id, phone: customer.phone, full_name: customer.full_name, email: customer.email },
    address: { recipient_name: "Test Buyer", phone: customer.phone, division: "Dhaka", district: "Dhaka", upazila: "Gulshan", street_address: `House ${tag}, Road 11` },
    paymentMethod: "cod",
    ip: `10.0.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`,
    ...overrides,
  });

  it("refuses a blocked phone outright", async () => {
    const c = await customerFor(BLOCKED_DEMO_PHONE);
    const cart = await cartWith(1);
    await expect(placeOrder(input(cart, c))).rejects.toMatchObject({ code: "BLOCKED" } satisfies Partial<OrderError>);
    expect(toE164BD(BLOCKED_DEMO_PHONE)).toBe(c.phone);
  });

  it("auto-confirms and auto-dispatches a clean COD order under the ceiling", async () => {
    const c = await customerFor(trusted);
    const cart = await cartWith(2); // ৳1,000 + delivery
    const r = await placeOrder(input(cart, c));
    orderIds.push(r.orderId);
    expect(r.status).toBe("confirmed");
    const { data: o } = await admin.from("orders").select("status, needs_review, fraud_score, tracking_id, shipments(normalized_status, cod_amount_bdt), order_events(event_type)").eq("id", r.orderId).single();
    expect(o!.needs_review).toBe(false);
    expect(o!.fraud_score).toBe(0);
    expect(o!.shipments?.length).toBe(1);
    expect(o!.shipments![0].normalized_status).toBe("created");
    expect(o!.shipments![0].cod_amount_bdt).toBe(r.totalBdt);
    expect(o!.tracking_id).toMatch(/^VG/);
    expect(o!.order_events!.map((e) => e.event_type)).toContain("auto_dispatched");
  });

  it("holds a risky phone in the review queue without dispatching", async () => {
    const c = await customerFor(risky);
    const cart = await cartWith(1);
    const r = await placeOrder(input(cart, c));
    orderIds.push(r.orderId);
    const { data: o } = await admin.from("orders").select("status, needs_review, fraud_score, otp_reverify_required, shipments(id)").eq("id", r.orderId).single();
    expect(o!.fraud_score).toBeGreaterThanOrEqual(30);
    expect(o!.fraud_score).toBeLessThan(60);
    expect(o!.needs_review).toBe(true);
    expect(o!.status).toBe("confirmed");
    expect(o!.shipments?.length ?? 0).toBe(0);
  });

  it("requires an advance and phone re-verification for a flagged phone", async () => {
    const c = await customerFor(flagged);
    const cart = await cartWith(1);
    const r = await placeOrder(input(cart, c));
    orderIds.push(r.orderId);
    const { data: o } = await admin.from("orders").select("status, needs_review, fraud_score, otp_reverify_required").eq("id", r.orderId).single();
    expect(o!.fraud_score).toBeGreaterThanOrEqual(80);
    expect(o!.status).toBe("awaiting_advance");
    expect(o!.needs_review).toBe(true);
    expect(o!.otp_reverify_required).toBe(true);
  });

  it("sends a large COD order to review even with a clean score", async () => {
    const c = await customerFor(trusted);
    const cart = await cartWith(14); // ৳7,000 > doubled ceiling 6,000
    const r = await placeOrder(input(cart, c));
    orderIds.push(r.orderId);
    const { data: o } = await admin.from("orders").select("needs_review, fraud_flags, shipments(id)").eq("id", r.orderId).single();
    expect(o!.needs_review).toBe(true);
    expect(JSON.stringify(o!.fraud_flags)).toMatch(/ceiling/);
    expect(o!.shipments?.length ?? 0).toBe(0);
  });

  it("restocks the items when the courier reports a return", async () => {
    const before = (await admin.from("product_variants").select("stock_qty").eq("id", variantId).single()).data!.stock_qty;
    const dispatched = orderIds[0];
    const { data: s } = await admin.from("shipments").select("consignment_id, invoice_ref").eq("order_id", dispatched).single();
    const r = await processCourierWebhook({ notification_type: "delivery_status", consignment_id: s!.consignment_id!, invoice: s!.invoice_ref!, status: "returned" }, "webhook");
    expect(r.ok).toBe(true);
    const after = (await admin.from("product_variants").select("stock_qty").eq("id", variantId).single()).data!.stock_qty;
    expect(after).toBe(before + 2);
    const { data: mv } = await admin.from("stock_movements").select("reason, delta").eq("order_id", dispatched).eq("reason", "return");
    expect(mv?.length).toBe(1);
    // idempotent: a second "returned" webhook does not restock twice
    await processCourierWebhook({ notification_type: "delivery_status", consignment_id: s!.consignment_id!, invoice: s!.invoice_ref!, status: "returned" }, "webhook");
    expect((await admin.from("product_variants").select("stock_qty").eq("id", variantId).single()).data!.stock_qty).toBe(before + 2);
  });
});
