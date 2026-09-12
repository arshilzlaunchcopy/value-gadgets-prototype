"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ORDER_STATUSES } from "@/lib/orders/statuses";
import { addAdminNoteAction, markReviewedAction, resendConfirmationSmsAction, setOrderStatusAction } from "../actions";

export function OrderActions({ orderId, status, needsReview, paymentMethod }: { orderId: string; status: string; needsReview: boolean; paymentMethod: string }) {
  const router = useRouter();
  const [next, setNext] = useState(status);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message ?? "Done");
      else toast.error(r.error ?? "Failed");
      router.refresh();
    });
  const canDispatch = ["confirmed", "processing", "packed"].includes(status);

  return (
    <section className="bg-paper space-y-3 rounded-2xl border p-4 text-sm">
      <h2 className="font-semibold">Actions</h2>
      {needsReview && (
        <div className="bg-amber/15 flex gap-2 rounded-lg p-2">
          <Button size="sm" className="rounded-lg" disabled={pending} onClick={() => run(() => markReviewedAction(orderId, true))}>Approve</Button>
          <Button size="sm" variant="destructive" className="rounded-lg" disabled={pending} onClick={() => confirm("Cancel this order?") && run(() => markReviewedAction(orderId, false))}>Cancel order</Button>
        </div>
      )}
      <div className="flex gap-2">
        <select value={next} onChange={(e) => setNext(e.target.value)} className="bg-paper flex-1 rounded-lg border px-2 py-1.5">
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <Button size="sm" className="rounded-lg" disabled={pending || next === status} onClick={() => run(() => setOrderStatusAction(orderId, next))}>
          Set
        </Button>
      </div>
      <Button size="sm" variant="outline" className="w-full rounded-lg" disabled={pending || !canDispatch} onClick={() => run(() => setOrderStatusAction(orderId, "shipped"))}>
        Dispatch to courier
      </Button>
      <Button size="sm" variant="outline" className="w-full rounded-lg" disabled={pending} onClick={() => run(() => resendConfirmationSmsAction(orderId))}>
        Resend confirmation SMS
      </Button>
      <div className="space-y-1">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Internal note…" className="rounded-lg text-xs" />
        <Button size="sm" variant="outline" className="rounded-lg" disabled={pending || !note.trim()} onClick={() => run(async () => { const r = await addAdminNoteAction(orderId, note); if (r.ok) setNote(""); return r; })}>
          Add note
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">{paymentMethod === "sslcommerz" ? "Refunds and invoice PDF arrive in Phase 15." : "Invoice PDF arrives in Phase 15."}</p>
    </section>
  );
}
