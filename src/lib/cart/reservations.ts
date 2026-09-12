import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCartSummary } from "./queries";

export const RESERVATION_MINUTES = 30;

export interface ReservationProblem {
  variant_id: string;
  title: string;
  requested: number;
  available: number;
}

/**
 * Hold every line of the cart for 30 minutes (PART2 §15.6). Re-running extends
 * the hold. Lines that cannot be fully reserved are reported, not silently cut.
 */
export async function reserveCart(cartId: string, minutes = RESERVATION_MINUTES): Promise<{ ok: boolean; problems: ReservationProblem[] }> {
  const admin = createAdminClient();
  await admin.rpc("release_expired_reservations");
  const cart = await getCartSummary(cartId);
  const problems: ReservationProblem[] = [];
  for (const line of cart.items) {
    const { data, error } = await admin.rpc("reserve_stock", { p_cart: cartId, p_variant: line.variant_id, p_qty: line.quantity, p_minutes: minutes });
    if (error) throw new Error(`reserve_stock: ${error.message}`);
    if (data === -1) {
      const { data: avail } = await admin.rpc("reserved_qty", { p_variant: line.variant_id, p_exclude_cart: cartId });
      const { data: v } = await admin.from("product_variants").select("stock_qty").eq("id", line.variant_id).single();
      problems.push({ variant_id: line.variant_id, title: line.title, requested: line.quantity, available: Math.max(0, (v?.stock_qty ?? 0) - (avail ?? 0)) });
    }
  }
  return { ok: problems.length === 0, problems };
}

export async function releaseCart(cartId: string): Promise<void> {
  await createAdminClient().rpc("release_cart_reservations", { p_cart: cartId });
}
