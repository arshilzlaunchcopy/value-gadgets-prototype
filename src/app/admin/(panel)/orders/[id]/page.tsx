import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { OrderTimeline } from "@/components/store/order-timeline";
import { formatBDT, formatDateTime } from "@/lib/format";
import { normalizeBD } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatusBadge } from "../orders-table";
import { OrderActions } from "./order-actions";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const admin = createAdminClient();
  const { data: o } = await admin
    .from("orders")
    .select("*, order_items(*), order_events(event_type, from_status, to_status, note, actor_type, created_at), payment_transactions(id, gateway, gateway_txn_id, val_id, bank_txn_id, amount_bdt, currency, status, card_type, validated_at, created_at), shipments(id, courier_code, consignment_id, tracking_code, normalized_status, status, cod_amount_bdt, dispatched_at, delivered_at, created_at)")
    .eq("id", id)
    .maybeSingle();
  if (!o) notFound();
  const [{ data: customer }, { data: score }] = await Promise.all([
    o.customer_id ? admin.from("customers").select("id, phone, full_name, email, total_orders, total_delivered, total_cancelled, total_returned, is_blocked, notes").eq("id", o.customer_id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("courier_score_cache").select("*").eq("phone", normalizeBD(o.customer_phone) ?? o.customer_phone).maybeSingle(),
  ]);
  const addr = (o.shipping_address ?? {}) as Record<string, string>;
  const events = [...(o.order_events ?? [])].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  const flags = Array.isArray(o.fraud_flags) ? (o.fraud_flags as string[]) : [];
  const risk = score ? (score.fraud_report_count > 0 ? "Flagged: courier fraud reports" : score.success_ratio === null ? "New: no courier history" : Number(score.success_ratio) >= 90 ? "Trusted: excellent delivery history" : Number(score.success_ratio) >= 70 ? "Good" : Number(score.success_ratio) >= 50 ? "Mixed: often refuses parcels" : "Risky: refuses most parcels") : "No courier score cached";

  return (
    <>
      <PageHeader
        title={o.order_number}
        description={`Placed ${formatDateTime(o.placed_at)} · ${o.payment_method === "cod" ? "Cash on delivery" : "Online payment"}`}
        actions={
          <>
            <StatusBadge s={o.status} />
            <StatusBadge s={o.payment_status} />
            {o.needs_review && <Link href="/admin/orders/review" className="bg-amber text-ink rounded-lg px-2 py-0.5 text-xs font-semibold">Review queue</Link>}
            {o.otp_reverify_required && <span className="bg-danger text-paper rounded-lg px-2 py-0.5 text-xs font-semibold">Re-verify phone</span>}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <section className="bg-paper rounded-2xl border p-4">
            <h2 className="mb-3 font-semibold">Timeline</h2>
            <OrderTimeline status={o.status} events={events} />
          </section>
          <section className="bg-paper rounded-2xl border p-4">
            <h2 className="mb-3 font-semibold">Items (snapshots)</h2>
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {(o.order_items ?? []).map((it) => (
                  <tr key={it.id}>
                    <td className="py-2">
                      {it.product_title}
                      {it.variant_label && <span className="text-muted-foreground block text-xs">{it.variant_label}</span>}
                      <span className="text-muted-foreground block text-xs">{it.sku}</span>
                    </td>
                    <td className="py-2 text-right tabular-nums">{it.quantity} × {formatBDT(it.unit_price_bdt)}</td>
                    <td className="price py-2 text-right">{formatBDT(it.line_total_bdt)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="text-sm">
                <tr><td colSpan={2} className="pt-3 text-right">Subtotal</td><td className="pt-3 text-right">{formatBDT(o.subtotal_bdt)}</td></tr>
                {o.discount_bdt > 0 && <tr><td colSpan={2} className="text-right">Discount {o.coupon_code ? `(${o.coupon_code})` : ""}</td><td className="text-success-deep text-right">-{formatBDT(o.discount_bdt)}</td></tr>}
                <tr><td colSpan={2} className="text-right">Delivery</td><td className="text-right">{formatBDT(o.shipping_bdt)}</td></tr>
                <tr className="font-semibold"><td colSpan={2} className="text-right">Total</td><td className="price text-right">{formatBDT(o.total_bdt)}</td></tr>
              </tfoot>
            </table>
          </section>
          <div className="grid gap-4 sm:grid-cols-2">
            <section className="bg-paper rounded-2xl border p-4 text-sm">
              <h2 className="mb-2 font-semibold">Payment transactions</h2>
              {!o.payment_transactions?.length ? (
                <p className="text-muted-foreground">None (COD).</p>
              ) : (
                <ul className="space-y-2">
                  {o.payment_transactions.map((t) => (
                    <li key={t.id} className="rounded-lg border p-2 text-xs">
                      <div className="flex items-center justify-between"><span className="font-mono">{t.gateway_txn_id}</span><StatusBadge s={t.status} /></div>
                      <p className="text-muted-foreground mt-1">{t.gateway} · {formatBDT(t.amount_bdt)} {t.currency} · {t.card_type ?? "—"}{t.validated_at ? ` · validated ${formatDateTime(t.validated_at)}` : ""}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="bg-paper rounded-2xl border p-4 text-sm">
              <h2 className="mb-2 font-semibold">Shipments</h2>
              {!o.shipments?.length ? (
                <p className="text-muted-foreground">Not dispatched yet.</p>
              ) : (
                <ul className="space-y-2">
                  {o.shipments.map((s) => (
                    <li key={s.id} className="rounded-lg border p-2 text-xs">
                      <div className="flex items-center justify-between"><span className="font-mono">{s.tracking_code}</span><StatusBadge s={s.normalized_status} /></div>
                      <p className="text-muted-foreground mt-1">{s.courier_code} · CID {s.consignment_id} · COD {formatBDT(s.cod_amount_bdt)}{s.dispatched_at ? ` · dispatched ${formatDateTime(s.dispatched_at)}` : ""}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>

        <aside className="space-y-4">
          <OrderActions orderId={o.id} status={o.status} needsReview={o.needs_review} needsReverify={o.otp_reverify_required} paymentMethod={o.payment_method} shipmentStatus={[...(o.shipments ?? [])].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0]?.normalized_status ?? null} />
          <section className={`rounded-2xl border p-4 text-sm ${(o.fraud_score ?? 0) >= 60 ? "bg-danger/5 border-danger/40" : (o.fraud_score ?? 0) >= 30 ? "bg-warn/10 border-warn/40" : "bg-paper"}`}>
            <h2 className="font-semibold">Fraud score: {o.fraud_score ?? "—"}</h2>
            <p className="mt-1 font-medium">{risk}</p>
            {score && score.success_ratio !== null && (
              <p className="text-muted-foreground text-xs">
                Courier: {score.total_delivered} delivered / {score.total_cancelled} cancelled of {score.total_parcels} ({Number(score.success_ratio)}%), {score.fraud_report_count} fraud report(s)
              </p>
            )}
            {flags.length > 0 && (
              <ul className="mt-2 list-disc pl-4 text-xs">
                {flags.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            )}
          </section>
          <section className="bg-paper rounded-2xl border p-4 text-sm">
            <h2 className="mb-2 font-semibold">Customer</h2>
            <p className="font-medium">{o.customer_name ?? "—"}</p>
            <p>{o.customer_phone}{o.customer_email ? ` · ${o.customer_email}` : ""}</p>
            {customer && (
              <p className="text-muted-foreground mt-1 text-xs">
                {customer.total_orders} orders · {customer.total_delivered} delivered · {customer.total_cancelled} cancelled · {customer.total_returned} returned{customer.is_blocked ? " · BLOCKED" : ""}
              </p>
            )}
            {customer && <Link href={`/admin/orders?q=${encodeURIComponent(o.customer_phone)}`} className="mt-1 inline-block text-xs underline">All orders from this phone</Link>}
            <h3 className="mt-3 text-xs font-semibold uppercase">Delivery address</h3>
            <p>{addr.recipient_name} · {addr.phone}</p>
            <p>{[addr.street_address, addr.area, addr.upazila, addr.district, addr.division].filter(Boolean).join(", ")}</p>
            {addr.landmark && <p className="text-muted-foreground">{addr.landmark}</p>}
            {o.customer_note && <p className="mt-2"><span className="font-medium">Customer note:</span> {o.customer_note}</p>}
            {(o.utm_source || o.landing_page) && <p className="text-muted-foreground mt-2 text-xs">Source: {o.utm_source ?? "direct"}{o.utm_campaign ? ` / ${o.utm_campaign}` : ""}{o.landing_page ? ` · landed on ${o.landing_page}` : ""}</p>}
          </section>
          {o.admin_note && (
            <section className="bg-paper rounded-2xl border p-4 text-sm">
              <h2 className="mb-2 font-semibold">Admin notes</h2>
              <pre className="whitespace-pre-wrap font-sans text-xs">{o.admin_note}</pre>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
