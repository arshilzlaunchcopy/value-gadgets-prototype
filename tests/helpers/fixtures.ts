import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/** Creates an isolated product + variant + order for a test and tears it all down. */
export async function createTestOrder(opts: { total: number; paymentMethod?: "cod" | "sslcommerz" }) {
  const admin = createAdminClient();
  const tag = randomBytes(4).toString("hex");
  const { data: product, error: pErr } = await admin.from("products").insert({ slug: `__test-${tag}`, title_en: `Test product ${tag}`, status: "draft" }).select("id").single();
  if (pErr) throw new Error(pErr.message);
  const { data: variant, error: vErr } = await admin.from("product_variants").insert({ product_id: product.id, sku: `TEST-${tag}`, price_bdt: opts.total, stock_qty: 5 }).select("id").single();
  if (vErr) throw new Error(vErr.message);
  const { data: order, error: oErr } = await admin
    .from("orders")
    .insert({
      order_number: `VGBD-TEST-${tag.slice(0, 4).toUpperCase()}`,
      status: "pending_payment",
      payment_method: opts.paymentMethod ?? "sslcommerz",
      payment_status: "unpaid",
      subtotal_bdt: opts.total,
      shipping_bdt: 0,
      total_bdt: opts.total,
      shipping_address: { recipient_name: "Test", district: "Dhaka" },
      customer_phone: "+8801700000001",
    })
    .select("*")
    .single();
  if (oErr) throw new Error(oErr.message);
  await admin.from("order_items").insert({ order_id: order.id, variant_id: variant.id, product_id: product.id, product_title: "Test product", sku: `TEST-${tag}`, unit_price_bdt: opts.total, quantity: 1, line_total_bdt: opts.total });

  return {
    order,
    async paymentStatus() {
      const { data } = await admin.from("orders").select("payment_status, status").eq("id", order.id).single();
      return data!;
    },
    async events() {
      const { data } = await admin.from("order_events").select("event_type, note").eq("order_id", order.id).order("created_at");
      return data ?? [];
    },
    async cleanup() {
      await admin.from("orders").delete().eq("id", order.id);
      await admin.from("products").delete().eq("id", product.id);
    },
  };
}
