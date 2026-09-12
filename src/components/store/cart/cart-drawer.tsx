"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMoney, useT } from "@/lib/i18n/provider";
import { CartLines } from "./cart-lines";
import { useCart } from "./cart-provider";

/** Slide-over cart (BUILD_PROMPT §6.1). Opens automatically after Add to Cart. */
export function CartDrawer() {
  const t = useT();
  const { money, number } = useMoney();
  const { cart, open, setOpen } = useCart();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("cart.title")}</SheetTitle>
          <SheetDescription>{t(cart.count === 1 ? "cart.item" : "cart.items", { n: number(cart.count) })}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4">
          <CartLines lines={cart.items} compact onNavigate={() => setOpen(false)} />
        </div>
        <div className="space-y-3 border-t p-4">
          <div className="flex items-center justify-between text-sm">
            <span>{t("cart.subtotal")}</span>
            <span className="price">{money(cart.subtotal_bdt)}</span>
          </div>
          <p className="text-muted-foreground text-xs">{t("cart.delivery_note")}</p>
          <Button asChild className="w-full rounded-2xl" disabled={cart.count === 0}>
            <Link href="/checkout" onClick={() => setOpen(false)}>
              {t("cart.checkout")}
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full rounded-2xl">
            <Link href="/cart" onClick={() => setOpen(false)}>
              {t("cart.title")}
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
