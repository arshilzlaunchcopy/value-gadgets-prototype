import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { formatBDT, formatDate, formatDateTime } from "@/lib/format";
import { normalizeBD } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatusBadge } from "../../orders/orders-table";
import { CustomerTools } from "./customer-tools";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const admin = createAdminClient();
  const { data: c } = await admin.from("customers").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();
  const [{ data: orders }, { data: addresses }, { data: score }, { data: block }] = await Promise.all([
    admin.from("orders").select("id, order_number, placed_at, status, payment_method, payment_status, total_bdt, fraud_score, source").eq("customer_id", id).order("placed_at", { ascending: false }).limit(100),
    admin.from("addresses").select("id, recipient_name, phone, division, district, upazila, area, street_address, landmark, is_default").eq("customer_id", id).order("is_default", { ascending: false }),
    admin.from("courier_score_cache").select("total_parcels, total_delivered, total_cancelled, success_ratio, fraud_report_count, checked_at").eq("phone", normalizeBD(c.phone) ?? c.phone).maybeSingle(),
    admin.from("blocked_entities").select("id, reason").eq("type", "phone").in("value", [c.phone, normalizeBD(c.phone) ?? c.phone]).maybeSingle(),
  ]);
  const ltv = (orders ?? []).filter((o) => !["cancelled", "returned", "refunded", "pending_payment"].includes(o.status)).reduce((n, o) => n + o.total_bdt, 0);
  const ratio = c.total_orders ? Math.round(((c.total_cancelled + c.total_returned) / c.total_orders) * 100) : 0;

  return (
    <>
      <PageHeader title={c.full_name ?? c.phone} description={`${c.phone}${c.email ? ` · ${c.email}` : ""} · customer since ${formatDate(c.created_at)}`} actions={c.is_blocked ? <span className="bg-danger text-paper rounded-lg px-2 py-0.5 text-xs font-semibold">Blocked</span> : undefined} />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["Lifetime value", formatBDT(ltv)],
              ["Orders", String(c.total_orders)],
              ["Delivered", String(c.total_delivered)],
              ["Cancel / return", `${c.total_cancelled + c.total_returned} (${ratio}%)`],
            ].map(([k, v]) => (
              <div key={k} className="bg-paper rounded-2xl border p-3">
                <p className="text-muted-foreground text-xs uppercase">{k}</p>
                <p className="price mt-1 text-xl">{v}</p>
              </div>
            ))}
          </div>
          <section className="bg-paper overflow-x-auto rounded-2xl border">
            <h2 className="border-b px-4 py-3 font-semibold">Order history</h2>
            <table className="w-full text-sm">
              <thead className="bg-paper-soft text-left text-xs uppercase"><tr><th className="px-3 py-2">Order</th><th className="px-3 py-2">Placed</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Payment</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-right">Fraud</th><th className="px-3 py-2">Source</th></tr></thead>
              <tbody>
                {(orders ?? []).map((o) => (
                  <tr key={o.id} className="border-t">
                    <td className="px-3 py-2"><Link href={`/admin/orders/${o.id}`} className="font-mono text-xs hover:underline">{o.order_number}</Link></td>
                    <td className="px-3 py-2 text-xs">{formatDateTime(o.placed_at)}</td>
                    <td className="px-3 py-2"><StatusBadge s={o.status} /></td>
                    <td className="px-3 py-2 text-xs">{o.payment_method === "cod" ? "COD" : "Online"} · {o.payment_status}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBDT(o.total_bdt)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{o.fraud_score ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">{o.source}</td>
                  </tr>
                ))}
                {(orders ?? []).length === 0 && <tr><td colSpan={7} className="text-muted-foreground px-3 py-6 text-center">No orders yet.</td></tr>}
              </tbody>
            </table>
          </section>
          <section className="bg-paper rounded-2xl border p-4 text-sm">
            <h2 className="mb-2 font-semibold">Addresses</h2>
            {(addresses ?? []).length === 0 ? (
              <p className="text-muted-foreground text-xs">None saved.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {(addresses ?? []).map((a) => (
                  <li key={a.id} className="rounded-lg border p-3 text-xs">
                    <p className="font-medium">{a.recipient_name} · {a.phone}{a.is_default ? " · default" : ""}</p>
                    <p>{[a.street_address, a.area, a.upazila, a.district, a.division].filter(Boolean).join(", ")}</p>
                    {a.landmark && <p className="text-muted-foreground">{a.landmark}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <aside className="space-y-4">
          <CustomerTools customer={{ id: c.id, phone: c.phone, full_name: c.full_name ?? "", email: c.email ?? "", notes: c.notes ?? "", is_blocked: c.is_blocked, block_reason: c.block_reason ?? "" }} blockReason={block?.reason ?? null} />
          <section className="bg-paper rounded-2xl border p-4 text-sm">
            <h2 className="mb-1 font-semibold">Courier score</h2>
            {score ? (
              <>
                <p>{score.total_delivered} delivered / {score.total_cancelled} cancelled of {score.total_parcels}{score.success_ratio !== null ? ` (${Number(score.success_ratio)}%)` : ""}</p>
                <p className="text-muted-foreground text-xs">{score.fraud_report_count} fraud report(s) · checked {formatDateTime(score.checked_at)}</p>
              </>
            ) : (
              <p className="text-muted-foreground text-xs">Not looked up yet (happens at the first order).</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
