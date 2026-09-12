"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import type { CartSummary } from "@/lib/cart/types";
import { formatBDT } from "@/lib/format";
import { CartLines } from "./cart-lines";
import { useCart } from "./cart-provider";
import { CouponForm } from "./coupon-form";

/** Full cart page. Seeded from the server, then kept in sync through the shared provider. */
export function CartPageClient({ initial }: { initial: CartSummary }) {
  const { cart, setCart, loaded } = useCart();
  useEffect(() => {
    if (!loaded) setCart(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once
  }, []);
  const c = loaded ? cart : initial;

  if (c.items.length === 0) {
    return (
      <div className="bg-paper rounded-2xl border p-8 text-center">
        <p className="text-muted-foreground">Your cart is empty.</p>
        <Button asChild className="mt-4 rounded-2xl">
          <Link href="/">Continue shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="bg-paper rounded-2xl border px-4">
        <CartLines lines={c.items} />
      </section>
      <aside className="bg-paper h-fit space-y-4 rounded-2xl border p-4">
        <h2 className="font-semibold">Summary</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal ({c.count} items)</dt>
            <dd className="price">{formatBDT(c.subtotal_bdt)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Delivery</dt>
            <dd className="text-muted-foreground">at checkout</dd>
          </div>
        </dl>
        <CouponForm />
        <Button asChild className="w-full rounded-2xl">
          <Link href="/checkout">Proceed to checkout</Link>
        </Button>
        <p className="text-muted-foreground text-xs">Cash on delivery, bKash, Nagad and cards accepted.</p>
      </aside>
    </div>
  );
}
