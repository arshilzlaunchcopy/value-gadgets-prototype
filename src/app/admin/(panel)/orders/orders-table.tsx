"use client";

import { createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type SortingState } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBDT, formatDateTime } from "@/lib/format";
import { ORDER_STATUSES } from "@/lib/orders/statuses";
import { bulkStatusAction } from "./actions";

export interface OrderRow {
  id: string;
  order_number: string;
  placed_at: string;
  status: string;
  payment_method: string;
  payment_status: string;
  total_bdt: number;
  customer_name: string | null;
  customer_phone: string;
  fraud_score: number | null;
  needs_review: boolean;
  courier: string | null;
  tracking_id: string | null;
  district: string;
}

const col = createColumnHelper<OrderRow>();

export function StatusBadge({ s }: { s: string }) {
  const tone = s === "delivered" || s === "paid" ? "bg-success/15 text-success-deep" : ["cancelled", "returned", "refunded", "failed"].includes(s) ? "bg-danger/15 text-danger" : ["shipped", "packed", "processing"].includes(s) ? "bg-ink text-paper" : "bg-muted";
  return <Badge className={`rounded-lg border-0 font-medium ${tone}`}>{s.replace(/_/g, " ")}</Badge>;
}

/** TanStack Table over the server-filtered page: sortable columns, row selection, bulk status. */
export function OrdersTable({ rows }: { rows: OrderRow[] }) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [bulk, setBulk] = useState("confirmed");
  const [pending, start] = useTransition();

  const columns = [
    col.display({
      id: "select",
      header: ({ table }) => <input type="checkbox" aria-label="Select all" checked={table.getIsAllRowsSelected()} onChange={table.getToggleAllRowsSelectedHandler()} className="accent-amber" />,
      cell: ({ row }) => <input type="checkbox" aria-label="Select row" checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} className="accent-amber" />,
    }),
    col.accessor("order_number", { header: "Order", cell: (c) => <Link href={`/admin/orders/${c.row.original.id}`} className="font-medium hover:underline">{c.getValue()}</Link> }),
    col.accessor("placed_at", { header: "Placed", cell: (c) => <span className="whitespace-nowrap text-xs">{formatDateTime(c.getValue())}</span> }),
    col.accessor("customer_name", { header: "Customer", cell: (c) => <span className="block max-w-40 truncate">{c.getValue() ?? c.row.original.customer_phone}<span className="text-muted-foreground block text-xs">{c.row.original.district}</span></span> }),
    col.accessor("status", { header: "Status", cell: (c) => <StatusBadge s={c.getValue()} /> }),
    col.accessor("payment_method", { header: "Payment", cell: (c) => <span className="text-xs">{c.getValue() === "cod" ? "COD" : "Online"} · <StatusBadge s={c.row.original.payment_status} /></span> }),
    col.accessor("total_bdt", { header: "Total", cell: (c) => <span className="price">{formatBDT(c.getValue())}</span> }),
    col.accessor("fraud_score", { header: "Fraud", cell: (c) => (c.getValue() === null ? "—" : <span className={`tabular-nums ${(c.getValue() ?? 0) >= 60 ? "text-danger font-semibold" : (c.getValue() ?? 0) >= 30 ? "text-warn-deep font-semibold" : ""}`}>{c.getValue()}{c.row.original.needs_review && " ⚑"}</span>) }),
    col.accessor("tracking_id", { header: "Courier", cell: (c) => (c.getValue() ? <span className="font-mono text-xs">{c.getValue()}</span> : <span className="text-muted-foreground text-xs">—</span>) }),
  ];

  const table = useReactTable({ data: rows, columns, state: { sorting, rowSelection: selection }, onSortingChange: setSorting, onRowSelectionChange: setSelection, getRowId: (r) => r.id, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), enableRowSelection: true });
  const selectedIds = Object.keys(selection).filter((k) => selection[k]);

  const applyBulk = () =>
    start(async () => {
      const r = await bulkStatusAction(selectedIds, bulk);
      if (r.ok) {
        toast.success(r.message ?? "Updated");
        setSelection({});
        router.refresh();
      } else toast.error(r.error ?? "Failed");
    });

  return (
    <div className="bg-paper overflow-hidden rounded-2xl border">
      {selectedIds.length > 0 && (
        <div className="bg-amber/15 flex flex-wrap items-center gap-2 border-b px-3 py-2 text-sm">
          <span className="font-medium">{selectedIds.length} selected</span>
          <select value={bulk} onChange={(e) => setBulk(e.target.value)} className="bg-paper rounded-lg border px-2 py-1 text-sm">
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <Button size="sm" className="rounded-lg" disabled={pending} onClick={applyBulk}>
            Apply
          </Button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-paper-soft text-left text-xs uppercase">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-3 py-2 font-medium" onClick={h.column.getToggleSortingHandler()} style={{ cursor: h.column.getCanSort() ? "pointer" : undefined }}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {{ asc: " ↑", desc: " ↓" }[h.column.getIsSorted() as string] ?? ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr key={r.id} className="hover:bg-accent/60 border-t">
                {r.getVisibleCells().map((c) => (
                  <td key={c.id} className="px-3 py-2 align-top">
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="text-muted-foreground px-3 py-8 text-center">
                  No orders match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
