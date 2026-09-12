import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { formatBDT } from "@/lib/format";
import { getCourier } from "@/lib/integrations/courier";
import { createAdminClient } from "@/lib/supabase/admin";
import { CourierTools, type ReconRow } from "./courier-tools";

export const dynamic = "force-dynamic";
export const metadata = { title: "Courier" };

const DAYS = 30;

function dhakaDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

/** Courier tooling (PART2 §14.7): balance, open shipments, daily COD reconciliation. */
export default async function CourierPage() {
  const admin = createAdminClient();
  const courier = getCourier();
  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
  const [balance, { data: delivered }, { data: returned }, { data: recon }, { data: open }, { data: settings }] = await Promise.all([
    courier.getBalance().catch(() => null),
    admin.from("shipments").select("delivered_at, cod_amount_bdt, courier_code, order_id, orders(payment_method, payment_status)").in("normalized_status", ["delivered", "partial_delivered"]).gte("delivered_at", since),
    admin.from("shipments").select("updated_at, courier_code").eq("normalized_status", "returned").gte("updated_at", since),
    admin.from("courier_reconciliation").select("*").gte("date", since.slice(0, 10)),
    admin.from("shipments").select("id, order_id, invoice_ref, tracking_code, normalized_status, dispatched_at, last_polled_at, courier_code").not("normalized_status", "in", "(delivered,partial_delivered,returned,cancelled,lost)").order("dispatched_at", { ascending: false }).limit(50),
    admin.from("settings").select("value").eq("key", "courier").maybeSingle(),
  ]);
  const lowBalance = Number(((settings?.value as { low_balance_warning_bdt?: number } | null) ?? {}).low_balance_warning_bdt ?? 5000);

  const days = new Map<string, ReconRow>();
  const key = (d: string, c: string) => `${d}|${c}`;
  for (const s of delivered ?? []) {
    if (!s.delivered_at) continue;
    const d = dhakaDate(s.delivered_at);
    const row = days.get(key(d, s.courier_code)) ?? { date: d, courier_code: s.courier_code, expected_cod_bdt: 0, delivered_count: 0, returned_count: 0, received_cod_bdt: null, variance_bdt: null, notes: null };
    row.delivered_count++;
    // the courier only collects COD; prepaid parcels carry cod_amount 0 by construction (§14.3)
    row.expected_cod_bdt += s.cod_amount_bdt;
    days.set(key(d, s.courier_code), row);
  }
  for (const s of returned ?? []) {
    const d = dhakaDate(s.updated_at);
    const row = days.get(key(d, s.courier_code)) ?? { date: d, courier_code: s.courier_code, expected_cod_bdt: 0, delivered_count: 0, returned_count: 0, received_cod_bdt: null, variance_bdt: null, notes: null };
    row.returned_count++;
    days.set(key(d, s.courier_code), row);
  }
  for (const r of recon ?? []) {
    const row = days.get(key(r.date, r.courier_code)) ?? { date: r.date, courier_code: r.courier_code, expected_cod_bdt: r.expected_cod_bdt, delivered_count: r.delivered_count, returned_count: r.returned_count, received_cod_bdt: null, variance_bdt: null, notes: null };
    row.received_cod_bdt = r.received_cod_bdt;
    row.variance_bdt = r.variance_bdt;
    row.notes = r.notes;
    days.set(key(r.date, r.courier_code), row);
  }
  const rows = [...days.values()].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <>
      <PageHeader
        title="Courier"
        description={`${courier.name}${courier.isMock ? " (mock)" : ""} · ${open?.length ?? 0} open shipment(s)`}
        actions={
          <Link href="/admin/orders?status=confirmed" className="rounded-lg border px-3 py-1.5 text-sm">Bulk dispatch from Orders</Link>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className={`rounded-2xl border p-4 ${balance !== null && balance < lowBalance ? "bg-danger/5 border-danger/40" : "bg-paper"}`}>
          <p className="text-muted-foreground text-xs font-medium uppercase">Courier balance</p>
          <p className="price mt-1 text-2xl">{balance === null ? "unavailable" : formatBDT(balance)}</p>
          {balance !== null && balance < lowBalance && <p className="text-danger mt-0.5 text-xs">Below the ৳{lowBalance.toLocaleString("en-IN")} warning line. Top up before end-of-day dispatch.</p>}
        </div>
        <div className="bg-paper rounded-2xl border p-4">
          <p className="text-muted-foreground text-xs font-medium uppercase">Delivered, last {DAYS} days</p>
          <p className="price mt-1 text-2xl">{delivered?.length ?? 0}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">COD expected {formatBDT(rows.reduce((n, r) => n + r.expected_cod_bdt, 0))}</p>
        </div>
        <div className="bg-paper rounded-2xl border p-4">
          <p className="text-muted-foreground text-xs font-medium uppercase">Returned, last {DAYS} days</p>
          <p className="price mt-1 text-2xl">{returned?.length ?? 0}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">Restocked automatically with a stock movement</p>
        </div>
      </div>
      <CourierTools rows={rows} open={(open ?? []).map((s) => ({ id: s.id, order_id: s.order_id, invoice_ref: s.invoice_ref, tracking_code: s.tracking_code, normalized_status: s.normalized_status, dispatched_at: s.dispatched_at, last_polled_at: s.last_polled_at }))} lowBalance={lowBalance} />
    </>
  );
}
