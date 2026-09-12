import type { Metadata } from "next";
import { CartPageClient } from "@/components/store/cart/cart-page-client";
import { getCartSummary } from "@/lib/cart/queries";
import { getCartId } from "@/lib/cart/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your cart", robots: { index: false } };

export default async function CartPage() {
  const cart = await getCartSummary(await getCartId());
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold sm:text-3xl">Your cart</h1>
      <CartPageClient initial={cart} />
    </>
  );
}
