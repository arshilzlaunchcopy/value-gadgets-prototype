import { PageHeader } from "@/components/admin/page-header";
import { formatDateTime } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { BulkAdjust } from "./bulk-adjust";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inventory" };

export default async function InventoryPage() {
  const admin = createAdminClient();
  const [{ data: variants }, { data: moves }] = await Promise.all([
    admin.from("product_variants").select("id, sku, option_value, stock_qty, low_stock_threshold, products(title_en, slug, status)").order("stock_qty").limit(400),
    admin.from("stock_movements").select("id, delta, reason, note, created_at, order_id, product_variants(sku, products(title_en))").order("created_at", { ascending: false }).limit(50),
  ]);
  const all = (variants ?? []).map((v) => ({ id: v.id, sku: v.sku, option_value: v.option_value, stock_qty: v.stock_qty, low_stock_threshold: v.low_stock_threshold, title: (v.products as { title_en: string; slug: string; status: string } | null)?.title_en ?? "", status: (v.products as { status: string } | null)?.status ?? "" }));
  const low = all.filter((v) => v.stock_qty <= v.low_stock_threshold && v.status === "active");

  return (
    <>
      <PageHeader title="Inventory" description={`${low.length} variant${low.length === 1 ? "" : "s"} at or below threshold`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="bg-paper rounded-2xl border p-4">
          <h2 className="mb-3 font-semibold">Low stock</h2>
          {low.length === 0 ? (
            <p className="text-muted-foreground text-sm">All good.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-left text-xs uppercase"><tr><th className="py-1">Product</th><th className="py-1">SKU</th><th className="py-1 text-right">Stock</th></tr></thead>
              <tbody className="divide-y">
                {low.map((v) => (
                  <tr key={v.id}>
                    <td className="py-1.5">{v.title}{v.option_value ? ` · ${v.option_value}` : ""}</td>
                    <td className="py-1.5 font-mono text-xs">{v.sku}</td>
                    <td className={`py-1.5 text-right tabular-nums ${v.stock_qty === 0 ? "text-danger font-semibold" : "text-warn-deep font-semibold"}`}>{v.stock_qty} / {v.low_stock_threshold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="bg-paper rounded-2xl border p-4">
          <h2 className="mb-3 font-semibold">Bulk adjustment</h2>
          <BulkAdjust variants={all.map((v) => ({ id: v.id, label: `${v.sku} · ${v.title}${v.option_value ? ` (${v.option_value})` : ""} · ${v.stock_qty} in stock` }))} />
        </section>
      </div>
      <section className="bg-paper mt-4 rounded-2xl border p-4">
        <h2 className="mb-3 font-semibold">Stock movement log</h2>
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-left text-xs uppercase"><tr><th className="py-1">When</th><th className="py-1">Variant</th><th className="py-1 text-right">Δ</th><th className="py-1">Reason</th><th className="py-1">Note</th></tr></thead>
          <tbody className="divide-y">
            {(moves ?? []).map((m) => {
              const v = m.product_variants as { sku: string; products: { title_en: string } | null } | null;
              return (
                <tr key={m.id}>
                  <td className="py-1.5 text-xs whitespace-nowrap">{formatDateTime(m.created_at)}</td>
                  <td className="py-1.5">{v?.products?.title_en ?? "—"} <span className="text-muted-foreground font-mono text-xs">{v?.sku}</span></td>
                  <td className={`py-1.5 text-right tabular-nums ${m.delta < 0 ? "text-danger" : "text-success-deep"}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</td>
                  <td className="py-1.5">{m.reason}</td>
                  <td className="text-muted-foreground py-1.5 text-xs">{m.note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
