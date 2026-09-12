"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STOCK_REASONS } from "@/lib/inventory/reasons";
import { adjustStockAction } from "./actions";

interface Line {
  variant_id: string;
  delta: number;
}

export function BulkAdjust({ variants }: { variants: { id: string; label: string }[] }) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([{ variant_id: "", delta: 0 }]);
  const [reason, setReason] = useState<(typeof STOCK_REASONS)[number]>("received");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const r = await adjustStockAction(lines.filter((l) => l.variant_id && l.delta !== 0), reason, note);
      if (r.ok) {
        toast.success(r.message ?? "Adjusted");
        setLines([{ variant_id: "", delta: 0 }]);
        setNote("");
        router.refresh();
      } else toast.error(r.error ?? "Failed");
    });

  return (
    <div className="space-y-2 text-sm">
      {lines.map((l, i) => (
        <div key={i} className="flex gap-2">
          <select value={l.variant_id} onChange={(e) => setLines((p) => p.map((x, k) => (k === i ? { ...x, variant_id: e.target.value } : x)))} className="bg-paper min-w-0 flex-1 rounded-lg border px-2 py-1.5">
            <option value="">Choose variant…</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
          <Input type="number" value={l.delta} onChange={(e) => setLines((p) => p.map((x, k) => (k === i ? { ...x, delta: Number(e.target.value) || 0 } : x)))} className="w-24 rounded-lg" aria-label="Quantity change" />
          <button type="button" aria-label="Remove line" onClick={() => setLines((p) => p.filter((_, k) => k !== i))} className="text-muted-foreground hover:text-danger p-1"><Trash2 className="size-4" /></button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => setLines((p) => [...p, { variant_id: "", delta: 0 }])}><Plus className="size-3.5" /> Line</Button>
      <div className="flex flex-wrap gap-2">
        <select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} className="bg-paper rounded-lg border px-2 py-1.5" aria-label="Reason">
          {STOCK_REASONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
        </select>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="flex-1 rounded-lg" />
        <Button type="button" className="rounded-lg" disabled={pending || !lines.some((l) => l.variant_id && l.delta)} onClick={submit}>Apply</Button>
      </div>
      <p className="text-muted-foreground text-xs">Positive numbers add stock, negative remove it. Every line becomes a stock movement.</p>
    </div>
  );
}
