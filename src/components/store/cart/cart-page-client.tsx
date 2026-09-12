"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import type { CartSummary } from "@/lib/cart/types";
import { useMoney, useT } from "@/lib/i18n/provider";
import { CartLines } from "./cart-lines";
import { useCart } from "./cart-provider";
import { CouponForm } from "./coupon-form";

/** Full cart page. Seeded from the server, then kept in sync through the shared provider. */
export function CartPageClient({ initial }: { initial: CartSummary }) {
  const t = useT();
  const { money, number } = useMoney();
  const { cart, setCart, loaded } = useCart();
  useEffect(() => {
    if (!loaded) setCart(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once
  }, []);
  const c = loaded ? cart : initial;

  if (c.items.length === 0) {
    return (
      <div className="bg-paper rounded-2xl border p-8 text-center">
        <p className="text-muted-foreground">{t("cart.empty")}</p>
        <Button asChild className="mt-4 rounded-2xl">
          <Link href="/">{t("cart.continue")}</Link>
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
        <h2 className="font-semibold">{t("checkout.summary")}</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt>{t("cart.subtotal")} ({t(c.count === 1 ? "cart.item" : "cart.items", { n: number(c.count) })})</dt>
            <dd className="price">{money(c.subtotal_bdt)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{t("checkout.delivery")}</dt>
            <dd className="text-muted-foreground">{t("cart.delivery_note")}</dd>
          </div>
        </dl>
        <CouponForm />
        <Button asChild className="w-full rounded-2xl">
          <Link href="/checkout">{t("cart.checkout")}</Link>
        </Button>
        <p className="text-muted-foreground text-xs">{t("checkout.cod")} · {t("checkout.online_sub")}</p>
      </aside>
    </div>
  );
}
