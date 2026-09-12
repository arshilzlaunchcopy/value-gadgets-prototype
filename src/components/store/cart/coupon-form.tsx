"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyCoupon, removeCoupon } from "@/lib/cart/actions";
import { useCart } from "./cart-provider";

export function CouponForm({ onChange }: { onChange?: () => void }) {
  const { cart, setCart } = useCart();
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();

  if (cart.coupon_code) {
    return (
      <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
        <span>
          Coupon <span className="font-semibold">{cart.coupon_code}</span> applied
        </span>
        <button
          type="button"
          disabled={pending}
          className="text-muted-foreground underline"
          onClick={() =>
            start(async () => {
              setCart((await removeCoupon()).cart);
              onChange?.();
            })
          }
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await applyCoupon(code);
          setCart(r.cart);
          if (r.ok) toast.success(r.message ?? "Coupon applied");
          else toast.error(r.message ?? "Invalid coupon");
          onChange?.();
        });
      }}
    >
      <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Coupon code" aria-label="Coupon code" className="rounded-lg uppercase" />
      <Button type="submit" variant="outline" disabled={pending || !code.trim()} className="rounded-lg">
        Apply
      </Button>
    </form>
  );
}
