import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 30-minute stock holds (PART2 §15.6): the last unit reserved by one cart is
 * not available to another; releasing or expiring the hold frees it.
 */
describe("stock reservations", () => {
  const admin = createAdminClient();
  const tag = randomBytes(4).toString("hex");
  let productId: string;
  let variantId: string;
  let cartA: string;
  let cartB: string;

  beforeAll(async () => {
    const { data: p } = await admin.from("products").insert({ slug: `__resv-${tag}`, title_en: "Reservation test", status: "draft" }).select("id").single();
    productId = p!.id;
    const { data: v } = await admin.from("product_variants").insert({ product_id: productId, sku: `RESV-${tag}`, price_bdt: 100, stock_qty: 1 }).select("id").single();
    variantId = v!.id;
    const { data: a } = await admin.from("carts").insert({ session_token: `t-${tag}-a` }).select("id").single();
    const { data: b } = await admin.from("carts").insert({ session_token: `t-${tag}-b` }).select("id").single();
    cartA = a!.id;
    cartB = b!.id;
  });

  afterAll(async () => {
    await admin.from("carts").delete().in("id", [cartA, cartB]);
    await admin.from("products").delete().eq("id", productId);
  });

  const reserve = async (cart: string, qty: number, minutes = 30) => {
    const { data, error } = await admin.rpc("reserve_stock", { p_cart: cart, p_variant: variantId, p_qty: qty, p_minutes: minutes });
    if (error) throw new Error(error.message);
    return data as number;
  };

  it("lets the first cart hold the last unit and blocks the second", async () => {
    expect(await reserve(cartA, 1)).toBe(0); // 0 left after A's hold
    expect(await reserve(cartB, 1)).toBe(-1); // B cannot
    const { data: pub } = await admin.from("product_variants_public").select("available_qty, stock_qty").eq("id", variantId).single();
    expect(pub!.stock_qty).toBe(1);
    expect(pub!.available_qty).toBe(0);
  });

  it("re-reserving from the same cart extends rather than double-counts", async () => {
    expect(await reserve(cartA, 1)).toBe(0);
  });

  it("frees the unit when the hold is released", async () => {
    const { data: released } = await admin.rpc("release_cart_reservations", { p_cart: cartA });
    expect(released).toBe(1);
    expect(await reserve(cartB, 1)).toBe(0);
  });

  it("frees the unit when the hold expires", async () => {
    // B holds it; make that hold already-expired (well past, to survive client/DB clock skew), then sweep
    const { data: updated, error: upErr } = await admin.from("stock_reservations").update({ expires_at: new Date(Date.now() - 5 * 60_000).toISOString() }).eq("cart_id", cartB).select("id");
    expect(upErr).toBeNull();
    expect(updated?.length).toBe(1);
    const { data: swept, error: sweepErr } = await admin.rpc("release_expired_reservations");
    expect(sweepErr).toBeNull();
    expect(swept).toBeGreaterThanOrEqual(1);
    expect(await reserve(cartA, 1)).toBe(0);
  });

  it("adjust_stock refuses to go negative", async () => {
    const { error } = await admin.rpc("adjust_stock", { p_variant: variantId, p_delta: -2, p_reason: "test" });
    expect(error?.message).toMatch(/insufficient stock/);
  });
});
