"use client";

import { Minus, Plus, ShoppingBag, Zap } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addToCart, buyNow } from "@/lib/cart/actions";
import type { VariantPublic } from "@/lib/catalog/queries";
import { formatBDT } from "@/lib/format";
import type { PictureData } from "@/lib/media/picture";
import { useCart } from "../cart/cart-provider";
import { Picture } from "../picture";
import { DiscountBadge, Price } from "../price";

export interface GalleryImage {
  id: string;
  variant_id: string | null;
  picture: PictureData;
}

interface Props {
  productTitle: string;
  images: GalleryImage[];
  variants: VariantPublic[];
  /** Server-rendered title / rating / brand block shown above the price */
  infoSlot: React.ReactNode;
  /** Server-rendered trust row shown under the buttons */
  trustSlot: React.ReactNode;
}

/**
 * Gallery + buy box share the selected variant, so this is the one client
 * island above the fold. The main image is the LCP element: eager + high priority.
 */
export function ProductPurchase({ productTitle, images, variants, infoSlot, trustSlot }: Props) {
  const defaultVariant = variants.find((v) => v.is_default && v.available_qty > 0) ?? variants.find((v) => v.available_qty > 0) ?? variants[0];
  const [variantId, setVariantId] = useState<string>(defaultVariant?.id ?? "");
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [pending, start] = useTransition();
  const { setCart, setOpen } = useCart();

  const variant = useMemo(() => variants.find((v) => v.id === variantId) ?? defaultVariant, [variants, variantId, defaultVariant]);
  const hasOptions = variants.some((v) => v.option_value);
  const available = variant?.available_qty ?? 0;
  const soldOut = available <= 0;
  const lowStock = !soldOut && available <= (variant?.low_stock_threshold ?? 5);

  function pickVariant(v: VariantPublic) {
    setVariantId(v.id);
    setQty((q) => Math.min(Math.max(1, q), Math.max(1, v.available_qty)));
    const idx = images.findIndex((i) => i.variant_id === v.id);
    if (idx >= 0) setActiveImage(idx);
  }

  const add = () =>
    start(async () => {
      if (!variant) return;
      const r = await addToCart(variant.id, qty);
      setCart(r.cart);
      if (r.ok) setOpen(true);
      else toast.error(r.message ?? "Could not add to cart");
    });

  const buy = () =>
    start(async () => {
      if (!variant) return;
      const r = await buyNow(variant.id, qty); // redirects on success
      setCart(r.cart);
      if (!r.ok) toast.error(r.message ?? "Could not start checkout");
    });

  const main = images[activeImage] ?? images[0];

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
      {/* Gallery */}
      <div>
        <div className="bg-paper overflow-hidden rounded-2xl border">
          <Picture data={main?.picture ?? null} sizes="(min-width: 1024px) 50vw, 100vw" priority className="block aspect-square w-full" imgClassName="h-full w-full object-cover" />
        </div>
        {images.length > 1 && (
          <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label={`${productTitle} images`}>
            {images.map((img, i) => (
              <li key={img.id}>
                <button
                  type="button"
                  onClick={() => setActiveImage(i)}
                  aria-label={`Show image ${i + 1}`}
                  aria-current={i === activeImage}
                  className={`block size-16 overflow-hidden rounded-lg border-2 ${i === activeImage ? "border-amber" : "border-transparent"}`}
                >
                  <Picture data={img.picture} sizes="64px" className="block size-full" imgClassName="size-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Buy box */}
      <div className="space-y-5">
        {infoSlot}

        <div className="flex flex-wrap items-center gap-3">
          <Price price={variant?.price_bdt ?? 0} compareAt={variant?.compare_at_price_bdt} size="lg" />
          <DiscountBadge price={variant?.price_bdt ?? 0} compareAt={variant?.compare_at_price_bdt} />
          {soldOut ? <span className="text-danger text-sm font-medium">Out of stock</span> : lowStock ? <span className="text-warn-deep text-sm font-medium">Only {available} left</span> : <span className="text-success-deep text-sm font-medium">In stock</span>}
        </div>

        {hasOptions && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{variants[0]?.option_name ?? "Option"}</legend>
            <div className="flex flex-wrap gap-2">
              {variants.map((v) => {
                const out = v.available_qty <= 0;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => pickVariant(v)}
                    disabled={out}
                    aria-pressed={v.id === variant?.id}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${v.id === variant?.id ? "border-ink bg-ink text-paper" : "bg-paper hover:border-ink"} ${out ? "cursor-not-allowed line-through opacity-50" : ""}`}
                  >
                    {v.option_value}
                    {out && <span className="sr-only"> (out of stock)</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center rounded-lg border" role="group" aria-label="Quantity">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1 || soldOut} className="hover:bg-accent px-3 py-2 disabled:opacity-40" aria-label="Decrease quantity">
              <Minus className="size-4" />
            </button>
            <span className="min-w-10 text-center tabular-nums">{qty}</span>
            <button type="button" onClick={() => setQty((q) => Math.min(available, 10, q + 1))} disabled={soldOut || qty >= Math.min(available, 10)} className="hover:bg-accent px-3 py-2 disabled:opacity-40" aria-label="Increase quantity">
              <Plus className="size-4" />
            </button>
          </div>
          {variant && <span className="text-muted-foreground text-xs">SKU {variant.sku}</span>}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button size="lg" onClick={buy} disabled={pending || soldOut || !variant} className="rounded-2xl">
            <Zap className="size-4" /> Buy Now
          </Button>
          <Button size="lg" variant="outline" onClick={add} disabled={pending || soldOut || !variant} className="rounded-2xl">
            <ShoppingBag className="size-4" /> Add to Cart
          </Button>
        </div>
        {variant && qty > 1 && <p className="text-muted-foreground text-sm">Total: <span className="price">{formatBDT(variant.price_bdt * qty)}</span></p>}

        {trustSlot}
      </div>
    </div>
  );
}
