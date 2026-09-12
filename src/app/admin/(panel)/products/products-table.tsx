"use client";

/* eslint-disable @next/next/no-img-element -- admin thumbnails */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBDT } from "@/lib/format";
import { bulkProductStatusAction, duplicateProductAction, setVariantStockAction } from "./actions";

export interface ProductRow {
  id: string;
  title_en: string;
  slug: string;
  status: string;
  is_featured: boolean;
  brand: string | null;
  image: string | null;
  categories: string[];
  variant_count: number;
  single_variant_id: string | null;
  min_price: number;
  stock: number;
  low: boolean;
  updated_at: string;
}

function toCsv(rows: ProductRow[]): string {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["id", "title", "slug", "status", "brand", "categories", "variants", "min_price_bdt", "stock"].join(",");
  return [head, ...rows.map((r) => [r.id, r.title_en, r.slug, r.status, r.brand, r.categories.join("|"), r.variant_count, r.min_price, r.stock].map(esc).join(","))].join("\n");
}

/** Products table (§6.2): inline stock editing, bulk status, duplicate, CSV export. */
export function ProductsTable({ rows }: { rows: ProductRow[] }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message ?? "Done");
      else toast.error(r.error ?? "Failed");
      router.refresh();
    });
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const exportCsv = () => {
    const blob = new Blob([toCsv(rows)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="bg-paper overflow-hidden rounded-2xl border">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-sm">
        {sel.size > 0 ? (
          <>
            <span className="font-medium">{sel.size} selected</span>
            {(["active", "draft", "archived"] as const).map((s) => (
              <Button key={s} size="sm" variant="outline" className="rounded-lg" disabled={pending} onClick={() => run(() => bulkProductStatusAction([...sel], s))}>
                Set {s}
              </Button>
            ))}
          </>
        ) : (
          <span className="text-muted-foreground">Select rows for bulk status changes.</span>
        )}
        <Button size="sm" variant="ghost" className="ml-auto rounded-lg" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-paper-soft text-left text-xs uppercase">
            <tr>
              <th className="px-3 py-2"><input type="checkbox" aria-label="Select all" checked={sel.size === rows.length && rows.length > 0} onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} className="accent-amber" /></th>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Price</th>
              <th className="px-3 py-2 font-medium">Stock</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-accent/60 border-t">
                <td className="px-3 py-2"><input type="checkbox" aria-label={`Select ${r.title_en}`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} className="accent-amber" /></td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="bg-paper-line size-10 shrink-0 overflow-hidden rounded-lg">{r.image && <img src={r.image} alt="" className="size-full object-cover" loading="lazy" />}</span>
                    <span className="min-w-0">
                      <Link href={`/admin/products/${r.id}`} className="block max-w-md truncate font-medium hover:underline">{r.title_en}</Link>
                      <span className="text-muted-foreground block text-xs">{[r.brand, ...r.categories].filter(Boolean).join(" · ")}{r.is_featured ? " · featured" : ""}</span>
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2"><Badge className={`rounded-lg border-0 ${r.status === "active" ? "bg-success/15 text-success-deep" : r.status === "archived" ? "bg-muted" : "bg-warn/20 text-warn-deep"}`}>{r.status}</Badge></td>
                <td className="price px-3 py-2">{formatBDT(r.min_price)}{r.variant_count > 1 && <span className="text-muted-foreground ml-1 text-xs font-normal">({r.variant_count} variants)</span>}</td>
                <td className="px-3 py-2">
                  {r.single_variant_id ? (
                    <input
                      type="number"
                      min={0}
                      defaultValue={r.stock}
                      aria-label={`Stock for ${r.title_en}`}
                      className={`w-20 rounded-lg border px-2 py-1 tabular-nums ${r.low ? "border-warn" : ""}`}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isInteger(v) && v !== r.stock) run(() => setVariantStockAction(r.single_variant_id!, v));
                      }}
                    />
                  ) : (
                    <span className={`tabular-nums ${r.low ? "text-warn-deep font-semibold" : ""}`}>{r.stock}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button asChild size="sm" variant="ghost" className="rounded-lg"><Link href={`/products/${r.slug}`} target="_blank">View</Link></Button>
                    <Button size="sm" variant="ghost" className="rounded-lg" disabled={pending} onClick={() => run(() => duplicateProductAction(r.id))}>Duplicate</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
