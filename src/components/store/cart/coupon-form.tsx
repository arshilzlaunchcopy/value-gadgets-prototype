"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyCoupon, removeCoupon } from "@/lib/cart/actions";
import { useT } from "@/lib/i18n/provider";
import { useCart } from "./cart-provider";

export function CouponForm({ onChange }: { onChange?: () => void }) {
  const t = useT();
  const { cart, setCart } = useCart();
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();

  if (cart.coupon_code) {
    return (
      <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
        <span>
          {t("cart.coupon")}: <span className="font-semibold">{cart.coupon_code}</span>
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
          {t("cart.remove")}
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
          if (r.ok) toast.success(r.message ?? t("cart.coupon_apply"));
          else toast.error(r.message ?? t("misc.error"));
          onChange?.();
        });
      }}
    >
      <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t("cart.coupon")} aria-label={t("cart.coupon")} className="rounded-lg uppercase" />
      <Button type="submit" variant="outline" disabled={pending || !code.trim()} className="rounded-lg">
        {t("cart.coupon_apply")}
      </Button>
    </form>
  );
}
