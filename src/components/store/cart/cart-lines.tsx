"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { removeItem, updateItemQty } from "@/lib/cart/actions";
import type { CartLine } from "@/lib/cart/types";
import { useMoney, useT } from "@/lib/i18n/provider";
import { useCart } from "./cart-provider";

/** Line items with quantity steppers. Every change is a Server Action; totals come back from the server. */
export function CartLines({ lines, compact = false, onNavigate }: { lines: CartLine[]; compact?: boolean; onNavigate?: () => void }) {
  const t = useT();
  const { money, number } = useMoney();
  const { setCart } = useCart();
  const [pending, start] = useTransition();

  const change = (id: string, qty: number) =>
    start(async () => {
      const r = qty <= 0 ? await removeItem(id) : await updateItemQty(id, qty);
      setCart(r.cart);
      if (!r.ok && r.message) toast.error(r.message);
    });

  if (lines.length === 0) return <p className="text-muted-foreground py-8 text-center text-sm">{t("cart.empty")}</p>;

  return (
    <ul className={`divide-y ${pending ? "opacity-70" : ""}`} aria-busy={pending}>
      {lines.map((l) => (
        <li key={l.id} className="flex gap-3 py-3">
          <Link href={`/products/${l.slug}`} onClick={onNavigate} className="bg-paper-line block size-16 shrink-0 overflow-hidden rounded-lg sm:size-20">
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-generated thumbnail */}
            {l.image && <img src={l.image.src} alt="" width={80} height={80} className="size-full object-cover" loading="lazy" />}
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={`/products/${l.slug}`} onClick={onNavigate} className={`line-clamp-2 font-medium ${compact ? "text-sm" : ""}`}>
              {l.title}
            </Link>
            {l.variant_label && <p className="text-muted-foreground text-xs">{l.variant_label}</p>}
            <div className="mt-1 flex items-center justify-between gap-2">
              <div className="inline-flex items-center rounded-lg border" role="group" aria-label={`${t("pdp.qty")}: ${l.title}`}>
                <button type="button" onClick={() => change(l.id, l.quantity - 1)} disabled={pending} className="hover:bg-accent px-2 py-1" aria-label="Decrease quantity">
                  <Minus className="size-3.5" />
                </button>
                <span className="min-w-8 text-center text-sm tabular-nums">{number(l.quantity)}</span>
                <button type="button" onClick={() => change(l.id, l.quantity + 1)} disabled={pending || l.quantity >= l.available_qty} className="hover:bg-accent px-2 py-1 disabled:opacity-40" aria-label="Increase quantity">
                  <Plus className="size-3.5" />
                </button>
              </div>
              <span className="price text-sm">{money(l.line_total_bdt)}</span>
            </div>
            {l.available_qty < l.quantity && <p className="text-danger mt-1 text-xs">{t("pdp.only_left", { n: number(l.available_qty) })}</p>}
          </div>
          <button type="button" onClick={() => change(l.id, 0)} disabled={pending} className="text-muted-foreground hover:text-danger self-start p-1" aria-label={`${t("cart.remove")}: ${l.title}`}>
            <Trash2 className="size-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
