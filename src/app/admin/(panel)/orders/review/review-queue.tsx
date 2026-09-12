"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatBDT, formatDate, formatDateTime } from "@/lib/format";
import { StatusBadge } from "../orders-table";
import { markReviewedAction } from "../actions";

export interface ReviewItem {
  id: string;
  order_number: string;
  placed_at: string;
  status: string;
  payment_method: string;
  total_bdt: number;
  customer_name: string | null;
  customer_phone: string;
  fraud_score: number;
  fraud_flags: string[];
  otp_reverify_required: boolean;
  address: string;
  district: string;
  ip: string | null;
  items: { title: string; qty: number; total: number }[];
  customer: { since: string; orders: number; delivered: number; cancelled: number; returned: number; blocked: boolean; notes: string | null } | null;
  courier: { parcels: number; delivered: number; cancelled: number; ratio: number | null; fraud_reports: number } | null;
  history: { id: string; order_number: string; status: string; payment_method: string; total_bdt: number; placed_at: string }[];
}

function riskLabel(c: ReviewItem["courier"]): string {
  if (!c) return "No courier score";
  if (c.fraud_reports > 0) return "Flagged: courier fraud reports";
  if (c.ratio === null || c.parcels === 0) return "New: no courier history";
  if (c.ratio >= 90) return "Trusted: excellent delivery history";
  if (c.ratio >= 70) return "Good delivery history";
  if (c.ratio >= 50) return "Mixed: often refuses parcels";
  return "Risky: refuses most parcels";
}

export function ReviewQueue({ items }: { items: ReviewItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const decide = (id: string, approve: boolean) => {
    if (!approve && !confirm("Cancel this order as fraud? The phone will score +50 on future orders.")) return;
    setBusy(id);
    start(async () => {
      const r = await markReviewedAction(id, approve);
      if (r.ok) toast.success(r.message ?? "Done");
      else toast.error(r.error ?? "Failed");
      setBusy(null);
      router.refresh();
    });
  };

  if (items.length === 0) return <p className="bg-paper text-muted-foreground rounded-2xl border p-8 text-center text-sm">Nothing to review. New flagged orders appear here automatically.</p>;

  return (
    <ul className="space-y-4">
      {items.map((o) => {
        const tone = o.fraud_score >= 60 ? "border-danger/40" : "border-warn/40";
        return (
          <li key={o.id} className={`bg-paper rounded-2xl border p-4 ${tone}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/orders/${o.id}`} className="text-lg font-semibold hover:underline">{o.order_number}</Link>
                  <StatusBadge s={o.status} />
                  <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${o.fraud_score >= 60 ? "bg-danger text-paper" : "bg-warn text-ink"}`}>Score {o.fraud_score}</span>
                  {o.otp_reverify_required && <span className="bg-ink text-paper rounded-lg px-2 py-0.5 text-xs font-semibold">Re-verify phone</span>}
                  {o.customer?.blocked && <span className="bg-danger text-paper rounded-lg px-2 py-0.5 text-xs font-semibold">Blocked customer</span>}
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {formatDateTime(o.placed_at)} · {o.payment_method === "cod" ? "Cash on delivery" : "Online"} · <span className="price">{formatBDT(o.total_bdt)}</span> · {o.district}
                  {o.ip ? ` · IP ${o.ip}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button className="rounded-lg" disabled={pending && busy === o.id} onClick={() => decide(o.id, true)}>Approve</Button>
                <Button variant="destructive" className="rounded-lg" disabled={pending && busy === o.id} onClick={() => decide(o.id, false)}>Cancel</Button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 text-sm lg:grid-cols-3">
              <section>
                <h3 className="text-muted-foreground mb-1 text-xs font-semibold uppercase">Why it is here</h3>
                <ul className="list-disc space-y-0.5 pl-4 text-xs">
                  {o.fraud_flags.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
                <p className="mt-2 font-medium">{riskLabel(o.courier)}</p>
                {o.courier && o.courier.ratio !== null && (
                  <p className="text-muted-foreground text-xs">
                    Courier: {o.courier.delivered} delivered / {o.courier.cancelled} cancelled of {o.courier.parcels} ({o.courier.ratio}%), {o.courier.fraud_reports} fraud report(s)
                  </p>
                )}
              </section>
              <section>
                <h3 className="text-muted-foreground mb-1 text-xs font-semibold uppercase">Customer</h3>
                <p className="font-medium">{o.customer_name ?? "—"} · {o.customer_phone}</p>
                <p className="text-xs">{o.address}</p>
                {o.customer ? (
                  <p className="text-muted-foreground mt-1 text-xs">
                    Since {formatDate(o.customer.since)} · {o.customer.orders} orders · {o.customer.delivered} delivered · {o.customer.cancelled} cancelled · {o.customer.returned} returned
                  </p>
                ) : (
                  <p className="text-muted-foreground mt-1 text-xs">Guest (no customer record)</p>
                )}
                {o.customer?.notes && <pre className="text-muted-foreground mt-1 whitespace-pre-wrap font-sans text-[11px]">{o.customer.notes}</pre>}
                <ul className="mt-2 space-y-0.5 text-xs">
                  {o.items.map((it, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="truncate">{it.qty} × {it.title}</span>
                      <span className="tabular-nums">{formatBDT(it.total)}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h3 className="text-muted-foreground mb-1 text-xs font-semibold uppercase">Order history ({o.history.length})</h3>
                {o.history.length === 0 ? (
                  <p className="text-muted-foreground text-xs">First order from this phone.</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {o.history.map((h) => (
                      <li key={h.id} className="flex items-center justify-between gap-2">
                        <Link href={`/admin/orders/${h.id}`} className="font-mono hover:underline">{h.order_number}</Link>
                        <span className="text-muted-foreground">{formatDate(h.placed_at)}</span>
                        <StatusBadge s={h.status} />
                        <span className="tabular-nums">{formatBDT(h.total_bdt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
