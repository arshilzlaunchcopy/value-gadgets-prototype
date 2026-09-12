"use client";

import { useEffect, useState } from "react";
import type { ProductSummary } from "@/lib/catalog/queries";
import { ProductCard } from "../product-card";
import { SectionHeading } from "../product-grid";

export const RECENT_KEY = "vg_recent";
const MAX = 20;

export function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

/** Mounted on the PDP: records the slug (newest first, de-duplicated). */
export function RecentlyViewedTracker({ slug }: { slug: string }) {
  useEffect(() => {
    try {
      const next = [slug, ...readRecent().filter((s) => s !== slug)].slice(0, MAX);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {}
  }, [slug]);
  return null;
}

export function RecentlyViewed({ title, limit, excludeProductId }: { title: string; limit: number; excludeProductId: string | null }) {
  const [items, setItems] = useState<ProductSummary[] | null>(null);
  useEffect(() => {
    const slugs = readRecent();
    if (slugs.length === 0) return setItems([]);
    const ctrl = new AbortController();
    fetch(`/api/products/summary?slugs=${encodeURIComponent(slugs.slice(0, limit + 1).join(","))}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j: { items: ProductSummary[] }) => {
        const order = new Map(slugs.map((s, i) => [s, i]));
        setItems(j.items.filter((p) => p.id !== excludeProductId).sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0)).slice(0, limit));
      })
      .catch(() => setItems([]));
    return () => ctrl.abort();
  }, [limit, excludeProductId]);
  if (!items || items.length === 0) return null;
  return (
    <div>
      <SectionHeading title={title} />
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
        {items.map((p) => (
          <li key={p.id} className="w-[46vw] shrink-0 snap-start sm:w-56 lg:w-64">
            <ProductCard product={p} />
          </li>
        ))}
      </ul>
    </div>
  );
}
