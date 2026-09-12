"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { availabilityFor, getCartSummary } from "./queries";
import { getCartId, getOrCreateCartId } from "./session";
import { validateCoupon } from "./totals";
import type { CartActionResult } from "./types";

const MAX_PER_LINE = 10;
const qtySchema = z.number().int().min(0).max(MAX_PER_LINE);
const uuid = z.string().uuid();

async function result(cartId: string | null, ok: boolean, message?: string): Promise<CartActionResult> {
  return { ok, message, cart: await getCartSummary(cartId) };
}

async function sweepExpiredReservations(): Promise<void> {
  // opportunistic cleanup; the scheduled function does the same every 10 min
  await createAdminClient().rpc("release_expired_reservations");
}

export async function addToCart(variantIdRaw: string, qtyRaw: number): Promise<CartActionResult> {
  const variantId = uuid.safeParse(variantIdRaw);
  const qty = qtySchema.safeParse(qtyRaw);
  if (!variantId.success || !qty.success || qty.data < 1) return result(await getCartId(), false, "Invalid item");

  const admin = createAdminClient();
  const { data: variant } = await admin.from("product_variants").select("id, products(status)").eq("id", variantId.data).maybeSingle();
  if (!variant || (variant.products as { status: string } | null)?.status !== "active") return result(await getCartId(), false, "This product is not available");

  await sweepExpiredReservations();
  const cartId = await getOrCreateCartId();
  const { data: existing } = await admin.from("cart_items").select("id, quantity").eq("cart_id", cartId).eq("variant_id", variantId.data).maybeSingle();
  const wanted = Math.min(MAX_PER_LINE, (existing?.quantity ?? 0) + qty.data);
  const available = (await availabilityFor([variantId.data], cartId)).get(variantId.data) ?? 0;
  if (available < wanted) {
    return result(cartId, false, available === 0 ? "Sorry, this item just sold out" : `Only ${available} left in stock`);
  }

  const res = existing
    ? await admin.from("cart_items").update({ quantity: wanted }).eq("id", existing.id)
    : await admin.from("cart_items").insert({ cart_id: cartId, variant_id: variantId.data, quantity: wanted });
  if (res.error) return result(cartId, false, "Could not add to cart");
  return result(cartId, true, "Added to cart");
}

export async function updateItemQty(itemIdRaw: string, qtyRaw: number): Promise<CartActionResult> {
  const itemId = uuid.safeParse(itemIdRaw);
  const qty = qtySchema.safeParse(qtyRaw);
  const cartId = await getCartId();
  if (!cartId || !itemId.success || !qty.success) return result(cartId, false, "Invalid request");

  const admin = createAdminClient();
  const { data: item } = await admin.from("cart_items").select("id, variant_id").eq("id", itemId.data).eq("cart_id", cartId).maybeSingle();
  if (!item) return result(cartId, false, "Item not in cart");
  if (qty.data === 0) {
    await admin.from("cart_items").delete().eq("id", item.id);
    return result(cartId, true, "Removed");
  }
  const available = (await availabilityFor([item.variant_id], cartId)).get(item.variant_id) ?? 0;
  if (available < qty.data) return result(cartId, false, `Only ${available} left in stock`);
  await admin.from("cart_items").update({ quantity: qty.data }).eq("id", item.id);
  return result(cartId, true);
}

export async function removeItem(itemIdRaw: string): Promise<CartActionResult> {
  return updateItemQty(itemIdRaw, 0);
}

export async function applyCoupon(codeRaw: string): Promise<CartActionResult & { discount_bdt?: number }> {
  const cartId = await getCartId();
  const code = z.string().trim().min(1).max(32).safeParse(codeRaw);
  if (!cartId || !code.success) return result(cartId, false, "Enter a coupon code");
  const cart = await getCartSummary(cartId);
  const v = await validateCoupon(code.data, cart.items, null);
  const admin = createAdminClient();
  if (!v.valid) {
    await admin.from("carts").update({ coupon_code: null }).eq("id", cartId);
    return result(cartId, false, v.message);
  }
  await admin.from("carts").update({ coupon_code: v.code }).eq("id", cartId);
  return { ...(await result(cartId, true, v.message)), discount_bdt: v.discount_bdt };
}

export async function removeCoupon(): Promise<CartActionResult> {
  const cartId = await getCartId();
  if (cartId) await createAdminClient().from("carts").update({ coupon_code: null }).eq("id", cartId);
  return result(cartId, true, "Coupon removed");
}

export async function clearCart(): Promise<CartActionResult> {
  const cartId = await getCartId();
  if (cartId) await createAdminClient().from("cart_items").delete().eq("cart_id", cartId);
  return result(cartId, true);
}

/** Buy Now: add, then straight to checkout (BUILD_PROMPT §6.1 PDP item 5). */
export async function buyNow(variantId: string, qty: number): Promise<CartActionResult> {
  const r = await addToCart(variantId, qty);
  if (!r.ok) return r;
  redirect("/checkout");
}
