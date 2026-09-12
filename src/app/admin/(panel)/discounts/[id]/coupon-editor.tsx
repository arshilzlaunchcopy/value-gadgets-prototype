"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { previewCoupon, type PreviewLine } from "@/lib/discounts/preview";
import type { CouponInput } from "@/lib/discounts/schema";
import { formatBDT } from "@/lib/format";
import { deleteCouponAction, saveCouponAction } from "../actions";

export interface CouponEditorData {
  coupon: (CouponInput & { id: string }) | null;
  categories: { id: string; label: string }[];
  products: { id: string; label: string; price_bdt: number }[];
  timesUsed: number;
}

const EMPTY: CouponInput = { code: "", description: "", type: "percentage", value: 10, min_order_bdt: 0, max_discount_bdt: null, usage_limit: null, usage_limit_per_customer: 1, applies_all: true, category_ids: [], product_ids: [], starts_at: "", ends_at: "", is_active: true };

export function CouponEditor({ data }: { data: CouponEditorData }) {
  const router = useRouter();
  const [c, setC] = useState<CouponInput>(data.coupon ?? EMPTY);
  const [sample, setSample] = useState<PreviewLine[]>(() => data.products.slice(0, 2).map((p) => ({ product_id: p.id, title: p.label, unit_price_bdt: p.price_bdt, quantity: 1 })));
  const [shipping, setShipping] = useState(60);
  const [pending, start] = useTransition();
  const set = <K extends keyof CouponInput>(k: K, v: CouponInput[K]) => setC({ ...c, [k]: v });

  // eligible products for the preview: products in the chosen categories are resolved server-side in real checkout;
  // here the admin picks explicit products, and category scoping is previewed as "all sample lines eligible".
  const preview = useMemo(
    () => previewCoupon({ type: c.type, value: c.value, min_order_bdt: c.min_order_bdt ?? 0, max_discount_bdt: c.max_discount_bdt ?? null, applies_all: c.applies_all ?? true, eligible_product_ids: (c.applies_all ?? true) ? undefined : [...(c.product_ids ?? []), ...((c.category_ids ?? []).length ? sample.map((l) => l.product_id) : [])] }, sample, shipping),
    [c, sample, shipping],
  );

  const save = () =>
    start(async () => {
      const r = await saveCouponAction(c);
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.message ?? "Saved");
      if (!data.coupon && r.data) router.replace(`/admin/discounts/${r.data.id}`);
      else router.refresh();
    });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <section className="bg-paper grid gap-3 rounded-2xl border p-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="code">Code</Label>
          <Input id="code" value={c.code} onChange={(e) => set("code", e.target.value.toUpperCase())} className="rounded-lg font-mono" placeholder="EID15" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="desc">Description (internal)</Label>
          <Input id="desc" value={c.description ?? ""} onChange={(e) => set("description", e.target.value)} className="rounded-lg" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="type">Type</Label>
          <select id="type" value={c.type} onChange={(e) => set("type", e.target.value as CouponInput["type"])} className="bg-paper h-10 w-full rounded-lg border px-3 text-sm">
            <option value="percentage">Percentage off</option>
            <option value="fixed">Fixed amount off (৳)</option>
            <option value="free_shipping">Free delivery</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="value">{c.type === "percentage" ? "Percent" : c.type === "fixed" ? "Amount (৳)" : "Value (ignored)"}</Label>
          <Input id="value" type="number" value={c.value} onChange={(e) => set("value", Number(e.target.value))} className="rounded-lg" disabled={c.type === "free_shipping"} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="min">Minimum order (৳)</Label>
          <Input id="min" type="number" value={c.min_order_bdt ?? 0} onChange={(e) => set("min_order_bdt", Number(e.target.value))} className="rounded-lg" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="max">Maximum discount (৳, blank = none)</Label>
          <Input id="max" type="number" value={c.max_discount_bdt ?? ""} onChange={(e) => set("max_discount_bdt", e.target.value === "" ? null : Number(e.target.value))} className="rounded-lg" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ul">Total usage limit (blank = unlimited)</Label>
          <Input id="ul" type="number" value={c.usage_limit ?? ""} onChange={(e) => set("usage_limit", e.target.value === "" ? null : Number(e.target.value))} className="rounded-lg" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ulc">Per customer (0 = unlimited)</Label>
          <Input id="ulc" type="number" value={c.usage_limit_per_customer ?? 1} onChange={(e) => set("usage_limit_per_customer", Number(e.target.value))} className="rounded-lg" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="starts">Starts</Label>
          <Input id="starts" type="datetime-local" value={c.starts_at ?? ""} onChange={(e) => set("starts_at", e.target.value)} className="rounded-lg" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ends">Ends</Label>
          <Input id="ends" type="datetime-local" value={c.ends_at ?? ""} onChange={(e) => set("ends_at", e.target.value)} className="rounded-lg" />
        </div>
        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <Label htmlFor="all">Applies to everything</Label>
          <Switch id="all" checked={c.applies_all ?? true} onCheckedChange={(v) => set("applies_all", v)} />
        </div>
        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <Label htmlFor="active">Active</Label>
          <Switch id="active" checked={c.is_active ?? true} onCheckedChange={(v) => set("is_active", v)} />
        </div>
        {!(c.applies_all ?? true) && (
          <>
            <div className="space-y-1">
              <Label>Categories</Label>
              <select multiple value={c.category_ids ?? []} onChange={(e) => set("category_ids", [...e.target.selectedOptions].map((o) => o.value))} className="bg-paper h-32 w-full rounded-lg border px-2 text-sm">
                {data.categories.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Products</Label>
              <select multiple value={c.product_ids ?? []} onChange={(e) => set("product_ids", [...e.target.selectedOptions].map((o) => o.value))} className="bg-paper h-32 w-full rounded-lg border px-2 text-sm">
                {data.products.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </div>
          </>
        )}
        <div className="flex gap-2 sm:col-span-2">
          <Button className="rounded-lg" disabled={pending || !c.code} onClick={save}>{data.coupon ? "Save coupon" : "Create coupon"}</Button>
          {data.coupon && (
            <Button variant="outline" className="text-danger rounded-lg" disabled={pending} onClick={() => confirm("Delete this coupon?") && start(async () => { const r = await deleteCouponAction(data.coupon!.id); if (r.ok) router.replace("/admin/discounts"); else toast.error(r.error); })}>
              Delete
            </Button>
          )}
        </div>
      </section>

      <aside className="bg-paper space-y-3 rounded-2xl border p-4 text-sm">
        <h2 className="font-semibold">Live preview on a sample cart</h2>
        <ul className="space-y-2">
          {sample.map((l, i) => (
            <li key={i} className="flex items-center gap-2">
              <select value={l.product_id} onChange={(e) => { const p = data.products.find((x) => x.id === e.target.value)!; setSample(sample.map((x, j) => (j === i ? { product_id: p.id, title: p.label, unit_price_bdt: p.price_bdt, quantity: x.quantity } : x))); }} className="bg-paper min-w-0 flex-1 rounded-lg border px-2 py-1 text-xs">
                {data.products.map((p) => <option key={p.id} value={p.id}>{p.label} ({formatBDT(p.price_bdt)})</option>)}
              </select>
              <Input type="number" min={1} value={l.quantity} onChange={(e) => setSample(sample.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, Number(e.target.value)) } : x)))} className="w-16 rounded-lg" aria-label="Quantity" />
              <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => setSample(sample.filter((_, j) => j !== i))}>×</Button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="rounded-lg" disabled={!data.products.length} onClick={() => setSample([...sample, { product_id: data.products[0].id, title: data.products[0].label, unit_price_bdt: data.products[0].price_bdt, quantity: 1 }])}>Add line</Button>
          <label className="flex items-center gap-1 text-xs">Delivery ৳ <Input type="number" value={shipping} onChange={(e) => setShipping(Number(e.target.value))} className="w-20 rounded-lg" /></label>
        </div>
        <dl className="space-y-1 border-t pt-3">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatBDT(preview.subtotal_bdt)}</dd></div>
          {!(c.applies_all ?? true) && <div className="flex justify-between"><dt>Eligible</dt><dd>{formatBDT(preview.eligible_bdt)}</dd></div>}
          <div className="text-success-deep flex justify-between"><dt>Discount</dt><dd>-{formatBDT(preview.discount_bdt)}</dd></div>
          <div className="flex justify-between"><dt>Delivery</dt><dd>{preview.shipping_bdt === 0 ? "Free" : formatBDT(preview.shipping_bdt)}</dd></div>
          <div className="flex justify-between font-semibold"><dt>Total</dt><dd className="price">{formatBDT(preview.total_bdt)}</dd></div>
        </dl>
        <p className={`text-xs ${preview.ok ? "text-success-deep" : "text-danger"}`}>{preview.message}</p>
      </aside>
    </div>
  );
}
