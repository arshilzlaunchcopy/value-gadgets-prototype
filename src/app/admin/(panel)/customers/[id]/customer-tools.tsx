"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveCustomerAction, setCustomerBlockedAction } from "../actions";

interface Customer {
  id: string;
  phone: string;
  full_name: string;
  email: string;
  notes: string;
  is_blocked: boolean;
  block_reason: string;
}

export function CustomerTools({ customer, blockReason }: { customer: Customer; blockReason: string | null }) {
  const router = useRouter();
  const [c, setC] = useState(customer);
  const [reason, setReason] = useState(customer.block_reason || blockReason || "");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message ?? "Saved");
      else toast.error(r.error ?? "Failed");
      router.refresh();
    });

  return (
    <section className="bg-paper space-y-3 rounded-2xl border p-4 text-sm">
      <h2 className="font-semibold">Profile & internal notes</h2>
      <div className="space-y-1">
        <Label htmlFor="name" className="text-xs">Name</Label>
        <Input id="name" value={c.full_name} onChange={(e) => setC({ ...c, full_name: e.target.value })} className="rounded-lg" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="email" className="text-xs">Email</Label>
        <Input id="email" type="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} className="rounded-lg" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="notes" className="text-xs">Internal notes (never shown to the customer)</Label>
        <Textarea id="notes" rows={4} value={c.notes} onChange={(e) => setC({ ...c, notes: e.target.value })} className="rounded-lg text-xs" />
      </div>
      <Button className="w-full rounded-lg" disabled={pending} onClick={() => run(() => saveCustomerAction({ id: c.id, full_name: c.full_name, email: c.email, notes: c.notes }))}>Save</Button>
      <div className={`space-y-2 rounded-lg p-3 ${c.is_blocked ? "bg-danger/10" : "bg-paper-soft"}`}>
        <p className="text-xs font-medium">{c.is_blocked ? "This customer is blocked: checkout refuses the phone." : "Block toggle: adds the phone to blocked entities and refuses checkout."}</p>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" className="rounded-lg text-xs" aria-label="Block reason" />
        <Button variant={c.is_blocked ? "outline" : "destructive"} className="w-full rounded-lg" disabled={pending} onClick={() => run(async () => { const r = await setCustomerBlockedAction(c.id, !c.is_blocked, reason); if (r.ok) setC({ ...c, is_blocked: !c.is_blocked }); return r; })}>
          {c.is_blocked ? "Unblock customer" : "Block customer"}
        </Button>
      </div>
    </section>
  );
}
