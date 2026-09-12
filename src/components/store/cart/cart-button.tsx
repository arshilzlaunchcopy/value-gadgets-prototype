"use client";

import { ShoppingBag } from "lucide-react";
import { useEffect } from "react";
import { useMoney, useT } from "@/lib/i18n/provider";
import { useCart } from "./cart-provider";

/** Header cart button. Fetches the count after mount so pages stay static. */
export function CartButton() {
  const t = useT();
  const { number } = useMoney();
  const { cart, loaded, refresh, setOpen } = useCart();
  useEffect(() => {
    if (!loaded) void refresh();
  }, [loaded, refresh]);
  return (
    <button type="button" onClick={() => setOpen(true)} className="hover:bg-ink-soft relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm" aria-label={`${t("nav.cart")}, ${cart.count}`}>
      <ShoppingBag className="size-5" />
      <span className="hidden sm:inline">{t("nav.cart")}</span>
      {cart.count > 0 && (
        <span className="bg-amber text-ink absolute -top-0.5 right-0.5 min-w-5 rounded-full px-1 text-center text-[11px] font-bold tabular-nums">{number(cart.count)}</span>
      )}
    </button>
  );
}
