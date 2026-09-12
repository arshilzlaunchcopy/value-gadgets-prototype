"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ORDER_STATUSES } from "@/lib/orders/statuses";
import { addAdminNoteAction, createReturnRequestAction, markPhoneReverifiedAction, markReviewedAction, resendConfirmationSmsAction, setOrderStatusAction } from "../actions";

interface Props {
  orderId: string;
  status: string;
  needsReview: boolean;
  needsReverify: boolean;
  paymentMethod: string;
  shipmentStatus: string | null;
}

export function OrderActions({ orderId, status, needsReview, needsReverify, paymentMethod, shipmentStatus }: Props) {
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
  const canReturn = shipmentStatus !== null && !["returned", "cancelled", "lost"].includes(shipmentStatus);

  return (
    <section className="bg-paper space-y-3 rounded-2xl border p-4 text-sm">
      <h2 className="font-semibold">Actions</h2>
      {needsReview && (
        <div className="bg-amber/15 flex gap-2 rounded-lg p-2">
          <Button size="sm" className="rounded-lg" disabled={pending} onClick={() => run(() => markReviewedAction(orderId, true))}>Approve</Button>
          <Button size="sm" variant="destructive" className="rounded-lg" disabled={pending} onClick={() => confirm("Cancel this order as fraud?") && run(() => markReviewedAction(orderId, false))}>Cancel order</Button>
        </div>
      )}
      {needsReverify && (
        <div className="bg-danger/10 space-y-1 rounded-lg p-2">
          <p className="text-xs font-medium">Score ≥ re-verify threshold: confirm the phone before dispatch (call or fresh OTP).</p>
          <Button size="sm" variant="outline" className="rounded-lg" disabled={pending} onClick={() => run(() => markPhoneReverifiedAction(orderId, prompt("How was the phone verified?", "phone call") ?? "call"))}>Mark phone re-verified</Button>
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
      <Button size="sm" variant="outline" className="w-full rounded-lg" disabled={pending || !canReturn} onClick={() => confirm("Ask the courier to return this parcel?") && run(() => createReturnRequestAction(orderId, prompt("Reason (optional)", "Customer refused delivery") ?? undefined))}>
        Request return from courier
      </Button>
      <Button asChild size="sm" variant="outline" className="w-full rounded-lg">
        <Link href={`/admin/print/order/${orderId}`} target="_blank">Print label + invoice</Link>
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
      {paymentMethod === "sslcommerz" && <p className="text-muted-foreground text-xs">Refund initiation arrives with the real gateway adapter (Phase 17).</p>}
    </section>
  );
}
