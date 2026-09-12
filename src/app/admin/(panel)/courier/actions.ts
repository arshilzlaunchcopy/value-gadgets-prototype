"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { pollOpenShipments } from "@/lib/courier/poll";
import { createAdminClient } from "@/lib/supabase/admin";

type R = { ok: boolean; error?: string; message?: string };
const fail = (e: unknown): R => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

const reconSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  courier_code: z.string().min(1).max(40),
  expected_cod_bdt: z.number().int().min(0),
  received_cod_bdt: z.number().int().min(0),
  delivered_count: z.number().int().min(0),
  returned_count: z.number().int().min(0),
  notes: z.string().max(500).optional().or(z.literal("")),
});

/** Daily COD reconciliation row (PART2 §14.7): delivered COD vs. courier payout, variance flagged. */
export async function saveReconciliationAction(raw: unknown): Promise<R> {
  try {
    const s = await requireAdmin("manager");
    const r = reconSchema.parse(raw);
    const { error } = await createAdminClient()
      .from("courier_reconciliation")
      .upsert({ ...r, notes: r.notes || null, variance_bdt: r.received_cod_bdt - r.expected_cod_bdt, reconciled_by: s.userId }, { onConflict: "date,courier_code" });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/courier");
    return { ok: true, message: `${r.date} reconciled` };
  } catch (e) {
    return fail(e);
  }
}

export async function pollNowAction(): Promise<R> {
  try {
    await requireAdmin();
    const r = await pollOpenShipments({ staleHours: 0 });
    revalidatePath("/admin/courier");
    const changed = r.results.filter((x) => x.changed).length;
    return { ok: true, message: `Polled ${r.checked} shipment(s), ${changed} changed` };
  } catch (e) {
    return fail(e);
  }
}

export async function saveCourierSettingsAction(lowBalanceRaw: number): Promise<R> {
  try {
    const s = await requireAdmin("manager");
    const low = z.number().int().min(0).parse(lowBalanceRaw);
    const admin = createAdminClient();
    const { data } = await admin.from("settings").select("value").eq("key", "courier").maybeSingle();
    const { error } = await admin.from("settings").upsert({ key: "courier", value: { ...((data?.value as object) ?? {}), low_balance_warning_bdt: low } as never, is_public: false, updated_by: s.userId }, { onConflict: "key" });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/courier");
    revalidatePath("/admin");
    return { ok: true, message: "Saved" };
  } catch (e) {
    return fail(e);
  }
}
