"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatBDT } from "@/lib/format";
import { CartLines } from "./cart-lines";
import { useCart } from "./cart-provider";

/** Slide-over cart (BUILD_PROMPT §6.1). Opens automatically after Add to Cart. */
export function CartDrawer() {
  const { cart, open, setOpen } = useCart();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Your cart</SheetTitle>
          <SheetDescription>
            {cart.count} item{cart.count === 1 ? "" : "s"}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4">
          <CartLines lines={cart.items} compact onNavigate={() => setOpen(false)} />
        </div>
        <div className="space-y-3 border-t p-4">
          <div className="flex items-center justify-between text-sm">
            <span>Subtotal</span>
            <span className="price">{formatBDT(cart.subtotal_bdt)}</span>
          </div>
          <p className="text-muted-foreground text-xs">Delivery charge is calculated at checkout from your district.</p>
          <Button asChild className="w-full rounded-2xl" disabled={cart.count === 0}>
            <Link href="/checkout" onClick={() => setOpen(false)}>
              Checkout
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full rounded-2xl">
            <Link href="/cart" onClick={() => setOpen(false)}>
              View cart
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
