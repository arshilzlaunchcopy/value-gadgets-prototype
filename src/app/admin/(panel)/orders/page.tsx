import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { ORDER_STATUSES } from "@/lib/orders/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { OrdersTable, type OrderRow } from "./orders-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orders" };

const PAGE = 50;
type SP = Record<string, string | string[] | undefined>;
const one = (sp: SP, k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) ?? "";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const f = { status: one(sp, "status"), payment: one(sp, "payment"), from: one(sp, "from"), to: one(sp, "to"), minFraud: Number(one(sp, "min_fraud")) || 0, courier: one(sp, "courier"), q: one(sp, "q").trim(), review: one(sp, "review") === "1", page: Math.max(1, Number(one(sp, "page")) || 1) };

  const admin = createAdminClient();
  let q = admin
    .from("orders")
    .select("id, order_number, placed_at, status, payment_method, payment_status, total_bdt, customer_name, customer_phone, fraud_score, needs_review, courier, tracking_id, shipping_address", { count: "exact" })
    .order("placed_at", { ascending: false });
  if (f.status) q = q.eq("status", f.status);
  if (f.payment) q = q.eq("payment_method", f.payment);
  if (f.from) q = q.gte("placed_at", new Date(f.from).toISOString());
  if (f.to) q = q.lte("placed_at", new Date(`${f.to}T23:59:59`).toISOString());
  if (f.minFraud) q = q.gte("fraud_score", f.minFraud);
  if (f.courier) q = q.eq("courier", f.courier);
  if (f.review) q = q.eq("needs_review", true).not("status", "in", "(cancelled,delivered,returned,refunded)");
  if (f.q) q = q.or(`order_number.ilike.%${f.q}%,customer_phone.ilike.%${f.q}%,customer_name.ilike.%${f.q}%`);
  const from = (f.page - 1) * PAGE;
  const { data, count } = await q.range(from, from + PAGE - 1);
  const rows: OrderRow[] = (data ?? []).map((o) => ({ ...o, district: ((o.shipping_address ?? {}) as { district?: string }).district ?? "" }));
  const total = count ?? 0;

  const qs = (patch: Record<string, string | number>) => {
    const p = new URLSearchParams();
    const all = { status: f.status, payment: f.payment, from: f.from, to: f.to, min_fraud: f.minFraud || "", courier: f.courier, q: f.q, review: f.review ? "1" : "", page: f.page, ...patch };
    for (const [k, v] of Object.entries(all)) if (v !== "" && v !== 0 && !(k === "page" && v === 1)) p.set(k, String(v));
    const s = p.toString();
    return `/admin/orders${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Orders" description={`${total} order${total === 1 ? "" : "s"} match`} />
      <form method="get" className="bg-paper mb-4 grid gap-2 rounded-2xl border p-3 sm:grid-cols-3 lg:grid-cols-7">
        <input name="q" defaultValue={f.q} placeholder="Order #, phone, name" className="bg-paper rounded-lg border px-3 py-2 text-sm lg:col-span-2" aria-label="Search" />
        <select name="status" defaultValue={f.status} className="bg-paper rounded-lg border px-3 py-2 text-sm" aria-label="Status">
          <option value="">Any status</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select name="payment" defaultValue={f.payment} className="bg-paper rounded-lg border px-3 py-2 text-sm" aria-label="Payment method">
          <option value="">Any payment</option>
          <option value="cod">COD</option>
          <option value="sslcommerz">Online</option>
        </select>
        <input type="date" name="from" defaultValue={f.from} className="bg-paper rounded-lg border px-3 py-2 text-sm" aria-label="From date" />
        <input type="date" name="to" defaultValue={f.to} className="bg-paper rounded-lg border px-3 py-2 text-sm" aria-label="To date" />
        <input type="number" name="min_fraud" min={0} max={100} defaultValue={f.minFraud || ""} placeholder="Fraud ≥" className="bg-paper rounded-lg border px-3 py-2 text-sm" aria-label="Minimum fraud score" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="review" value="1" defaultChecked={f.review} className="accent-amber" /> Review queue only
        </label>
        <select name="courier" defaultValue={f.courier} className="bg-paper rounded-lg border px-3 py-2 text-sm" aria-label="Courier">
          <option value="">Any courier</option>
          <option value="mock">Mock courier</option>
          <option value="steadfast">Steadfast</option>
        </select>
        <div className="flex gap-2 lg:col-span-2">
          <button type="submit" className="bg-ink text-paper rounded-lg px-4 py-2 text-sm">Filter</button>
          <Link href="/admin/orders" className="rounded-lg border px-4 py-2 text-sm">Clear</Link>
        </div>
      </form>
      <OrdersTable rows={rows} />
      <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
        <span className="text-muted-foreground">
          Page {f.page} of {Math.max(1, Math.ceil(total / PAGE))}
        </span>
        <div className="flex gap-2">
          {f.page > 1 && <Link href={qs({ page: f.page - 1 })} className="rounded-lg border px-3 py-1.5">Previous</Link>}
          {from + PAGE < total && <Link href={qs({ page: f.page + 1 })} className="rounded-lg border px-3 py-1.5">Next</Link>}
        </div>
      </nav>
    </>
  );
}
