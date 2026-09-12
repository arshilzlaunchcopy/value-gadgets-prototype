"use client";

import { ShoppingBag } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addToCart } from "@/lib/cart/actions";
import type { VariantPublic } from "@/lib/catalog/queries";
import { useCart } from "../cart/cart-provider";
import { Price } from "../price";

/** Client island for the featured_product block: variant pick + add to cart. */
export function FeaturedBuyBox({ variants, label }: { variants: VariantPublic[]; label: string }) {
  const first = variants.find((v) => v.is_default && v.available_qty > 0) ?? variants.find((v) => v.available_qty > 0) ?? variants[0];
  const [variantId, setVariantId] = useState(first?.id ?? "");
  const [pending, start] = useTransition();
  const { setCart, setOpen } = useCart();
  const variant = variants.find((v) => v.id === variantId) ?? first;
  if (!variant) return null;
  const soldOut = variant.available_qty <= 0;
  const hasOptions = variants.some((v) => v.option_value);

  const add = () =>
    start(async () => {
      const r = await addToCart(variant.id, 1);
      setCart(r.cart);
      if (r.ok) setOpen(true);
      else toast.error(r.message ?? "Could not add");
    });

  return (
    <div className="space-y-3">
      <Price price={variant.price_bdt} compareAt={variant.compare_at_price_bdt} size="lg" />
      {hasOptions && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={variant.option_name ?? "Option"}>
          {variants.map((v) => (
            <button key={v.id} type="button" role="radio" aria-checked={v.id === variantId} disabled={v.available_qty <= 0} onClick={() => setVariantId(v.id)} className={`rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40 ${v.id === variantId ? "border-ink bg-ink text-paper" : "hover:border-ink"}`}>
              {v.option_value}
            </button>
          ))}
        </div>
      )}
      <Button type="button" onClick={add} disabled={pending || soldOut} className="bg-amber text-ink hover:bg-amber-lite h-11 rounded-2xl px-6 font-semibold">
        <ShoppingBag className="size-4" />
        {soldOut ? "Out of stock" : label}
      </Button>
    </div>
  );
}
