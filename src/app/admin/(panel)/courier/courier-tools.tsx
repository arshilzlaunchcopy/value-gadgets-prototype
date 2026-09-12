"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBDT, formatDateTime } from "@/lib/format";
import { StatusBadge } from "../orders/orders-table";
import { pollNowAction, saveCourierSettingsAction, saveReconciliationAction } from "./actions";

export interface ReconRow {
  date: string;
  courier_code: string;
  expected_cod_bdt: number;
  delivered_count: number;
  returned_count: number;
  received_cod_bdt: number | null;
  variance_bdt: number | null;
  notes: string | null;
}

interface OpenShipment {
  id: string;
  order_id: string;
  invoice_ref: string | null;
  tracking_code: string | null;
  normalized_status: string;
  dispatched_at: string | null;
  last_polled_at: string | null;
}

type R = { ok: boolean; error?: string; message?: string };

export function CourierTools({ rows, open, lowBalance }: { rows: ReconRow[]; open: OpenShipment[]; lowBalance: number }) {
  const router = useRouter();
  const [edits, setEdits] = useState<Record<string, { received: string; notes: string }>>({});
  const [low, setLow] = useState(String(lowBalance));
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<R>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message ?? "Saved");
      else toast.error(r.error ?? "Failed");
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <section className="bg-paper rounded-2xl border p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Daily COD reconciliation (PART2 §14.7)</h2>
          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="low">Low-balance warning ৳</label>
            <Input id="low" type="number" value={low} onChange={(e) => setLow(e.target.value)} className="w-28 rounded-lg" />
            <Button size="sm" variant="outline" className="rounded-lg" disabled={pending} onClick={() => run(() => saveCourierSettingsAction(Number(low)))}>Save</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper-soft text-left text-xs uppercase">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Courier</th>
                <th className="px-3 py-2 text-right">Delivered</th>
                <th className="px-3 py-2 text-right">Returned</th>
                <th className="px-3 py-2 text-right">COD expected</th>
                <th className="px-3 py-2 text-right">Received</th>
                <th className="px-3 py-2 text-right">Variance</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={9} className="text-muted-foreground px-3 py-6 text-center">No deliveries in the last 30 days.</td></tr>
              )}
              {rows.map((r) => {
                const k = `${r.date}|${r.courier_code}`;
                const e = edits[k] ?? { received: r.received_cod_bdt === null ? "" : String(r.received_cod_bdt), notes: r.notes ?? "" };
                const received = e.received === "" ? null : Number(e.received);
                const variance = received === null ? r.variance_bdt : received - r.expected_cod_bdt;
                return (
                  <tr key={k} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{r.date}</td>
                    <td className="px-3 py-2 text-xs">{r.courier_code}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.delivered_count}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.returned_count}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBDT(r.expected_cod_bdt)}</td>
                    <td className="px-3 py-2 text-right"><Input type="number" value={e.received} onChange={(ev) => setEdits({ ...edits, [k]: { ...e, received: ev.target.value } })} className="w-28 rounded-lg text-right" aria-label={`Received on ${r.date}`} /></td>
                    <td className={`px-3 py-2 text-right tabular-nums ${variance === null ? "text-muted-foreground" : variance !== 0 ? "text-danger font-semibold" : "text-success-deep"}`}>{variance === null ? "—" : `${variance > 0 ? "+" : ""}${formatBDT(variance)}`}</td>
                    <td className="px-3 py-2"><Input value={e.notes} onChange={(ev) => setEdits({ ...edits, [k]: { ...e, notes: ev.target.value } })} className="w-40 rounded-lg" aria-label={`Notes for ${r.date}`} /></td>
                    <td className="px-3 py-2">
                      <Button size="sm" variant="outline" className="rounded-lg" disabled={pending || received === null} onClick={() => run(() => saveReconciliationAction({ date: r.date, courier_code: r.courier_code, expected_cod_bdt: r.expected_cod_bdt, received_cod_bdt: received ?? 0, delivered_count: r.delivered_count, returned_count: r.returned_count, notes: e.notes }))}>
                        Save
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-paper rounded-2xl border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Open shipments</h2>
          <Button size="sm" variant="outline" className="rounded-lg" disabled={pending} onClick={() => run(pollNowAction)}>Poll courier now</Button>
        </div>
        <p className="text-muted-foreground mb-2 text-xs">The polling fallback runs every 30 minutes for shipments not polled in 2 hours (PART2 §14.4). Webhooks update instantly.</p>
        <ul className="divide-y text-sm">
          {open.length === 0 && <li className="text-muted-foreground py-2 text-xs">No open shipments.</li>}
          {open.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-2">
              <Link href={`/admin/orders/${s.order_id}`} className="font-mono text-xs hover:underline">{s.invoice_ref}</Link>
              <span className="font-mono text-xs">{s.tracking_code}</span>
              <StatusBadge s={s.normalized_status} />
              <span className="text-muted-foreground ml-auto text-xs">dispatched {formatDateTime(s.dispatched_at)}{s.last_polled_at ? ` · polled ${formatDateTime(s.last_polled_at)}` : ""}</span>
              <Link href={`/admin/print/order/${s.order_id}`} className="text-xs underline" target="_blank">Label</Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
