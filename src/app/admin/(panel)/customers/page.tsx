import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { formatBDT, formatDate } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customers" };

type SP = Record<string, string | string[] | undefined>;
const one = (sp: SP, k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) ?? "";

/** Customers (BUILD_PROMPT §6.2): lifetime value, order counts, cancellation ratio, block state. */
export default async function CustomersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = one(sp, "q").trim();
  const only = one(sp, "only");
  const admin = createAdminClient();
  let cq = admin.from("customers").select("id, phone, full_name, email, is_blocked, total_orders, total_delivered, total_cancelled, total_returned, created_at").order("total_orders", { ascending: false }).limit(500);
  if (q) cq = cq.or(`phone.ilike.%${q}%,full_name.ilike.%${q}%,email.ilike.%${q}%`);
  if (only === "blocked") cq = cq.eq("is_blocked", true);
  if (only === "risky") cq = cq.gt("total_cancelled", 0);
  const { data: customers } = await cq;
  const ids = (customers ?? []).map((c) => c.id);
  const { data: orders } = ids.length ? await admin.from("orders").select("customer_id, total_bdt, status, placed_at").in("customer_id", ids) : { data: [] as { customer_id: string | null; total_bdt: number; status: string; placed_at: string }[] };
  const ltv = new Map<string, { value: number; last: string }>();
  for (const o of orders ?? []) {
    if (!o.customer_id) continue;
    const cur = ltv.get(o.customer_id) ?? { value: 0, last: o.placed_at };
    if (!["cancelled", "returned", "refunded", "pending_payment"].includes(o.status)) cur.value += o.total_bdt;
    if (o.placed_at > cur.last) cur.last = o.placed_at;
    ltv.set(o.customer_id, cur);
  }
  const ratio = (c: { total_orders: number; total_cancelled: number; total_returned: number }) => (c.total_orders ? Math.round(((c.total_cancelled + c.total_returned) / c.total_orders) * 100) : 0);

  return (
    <>
      <PageHeader title="Customers" description={`${customers?.length ?? 0} shown · lifetime value excludes cancelled, returned and unpaid orders`} />
      <form method="get" className="bg-paper mb-4 flex flex-wrap gap-2 rounded-2xl border p-3">
        <input name="q" defaultValue={q} placeholder="Phone, name or email" className="bg-paper rounded-lg border px-3 py-2 text-sm" aria-label="Search" />
        <select name="only" defaultValue={only} className="bg-paper rounded-lg border px-3 py-2 text-sm" aria-label="Filter">
          <option value="">Everyone</option>
          <option value="risky">Has cancellations</option>
          <option value="blocked">Blocked</option>
        </select>
        <button type="submit" className="bg-ink text-paper rounded-lg px-4 py-2 text-sm">Filter</button>
        <Link href="/admin/customers" className="rounded-lg border px-4 py-2 text-sm">Clear</Link>
      </form>
      <div className="bg-paper overflow-x-auto rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-paper-soft text-left text-xs uppercase">
            <tr><th className="px-3 py-2">Customer</th><th className="px-3 py-2 text-right">Orders</th><th className="px-3 py-2 text-right">Delivered</th><th className="px-3 py-2 text-right">Cancel/return</th><th className="px-3 py-2 text-right">Lifetime value</th><th className="px-3 py-2">Last order</th><th className="px-3 py-2">Since</th></tr>
          </thead>
          <tbody>
            {(customers ?? []).map((c) => {
              const r = ratio(c);
              const v = ltv.get(c.id);
              return (
                <tr key={c.id} className="border-t">
                  <td className="px-3 py-2">
                    <Link href={`/admin/customers/${c.id}`} className="font-medium hover:underline">{c.full_name ?? c.phone}</Link>
                    <span className="text-muted-foreground block text-xs">{c.phone}{c.email ? ` · ${c.email}` : ""}{c.is_blocked ? " · " : ""}{c.is_blocked && <span className="text-danger font-semibold">BLOCKED</span>}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.total_orders}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.total_delivered}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${r > 40 ? "text-danger font-semibold" : r > 20 ? "text-warn-deep" : ""}`}>{c.total_cancelled + c.total_returned} ({r}%)</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBDT(v?.value ?? 0)}</td>
                  <td className="px-3 py-2 text-xs">{v ? formatDate(v.last) : "—"}</td>
                  <td className="px-3 py-2 text-xs">{formatDate(c.created_at)}</td>
                </tr>
              );
            })}
            {(customers ?? []).length === 0 && <tr><td colSpan={7} className="text-muted-foreground px-3 py-8 text-center">No customers match.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
