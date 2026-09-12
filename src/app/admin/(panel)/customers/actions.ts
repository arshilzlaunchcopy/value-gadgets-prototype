"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/admin";
import { normalizeBD } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";

type R = { ok: boolean; error?: string; message?: string };
const fail = (e: unknown): R => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

const profileSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().max(80).optional().or(z.literal("")),
  email: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().max(4000).optional().or(z.literal("")),
});

export async function saveCustomerAction(raw: unknown): Promise<R> {
  try {
    const s = await requireAdmin();
    const p = profileSchema.parse(raw);
    if (p.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email)) return { ok: false, error: "Enter a valid email" };
    const admin = createAdminClient();
    const { data: before } = await admin.from("customers").select("full_name, email, notes").eq("id", p.id).single();
    const { error } = await admin.from("customers").update({ full_name: p.full_name || null, email: p.email || null, notes: p.notes || null }).eq("id", p.id);
    if (error) return { ok: false, error: error.message };
    await audit(s, "customer.update", { type: "customer", id: p.id, before, after: { full_name: p.full_name, email: p.email, notes: p.notes } });
    revalidatePath(`/admin/customers/${p.id}`);
    return { ok: true, message: "Customer saved" };
  } catch (e) {
    return fail(e);
  }
}

/** Block toggle (BUILD_PROMPT §6.2): mirrors into blocked_entities so checkout refuses the phone. */
export async function setCustomerBlockedAction(idRaw: string, blocked: boolean, reasonRaw: string): Promise<R> {
  try {
    const s = await requireAdmin("manager");
    const id = z.string().uuid().parse(idRaw);
    const reason = z.string().trim().max(300).parse(reasonRaw);
    const admin = createAdminClient();
    const { data: c } = await admin.from("customers").select("phone, is_blocked").eq("id", id).single();
    if (!c) return { ok: false, error: "Customer not found" };
    const { error } = await admin.from("customers").update({ is_blocked: blocked, block_reason: blocked ? reason || "Blocked by admin" : null }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    const values = [c.phone, normalizeBD(c.phone) ?? c.phone];
    if (blocked) await admin.from("blocked_entities").upsert({ type: "phone", value: c.phone, reason: reason || "Blocked from customer page", blocked_by: s.userId, expires_at: null }, { onConflict: "type,value" });
    else await admin.from("blocked_entities").delete().eq("type", "phone").in("value", values);
    await audit(s, blocked ? "customer.block" : "customer.unblock", { type: "customer", id, before: { is_blocked: c.is_blocked }, after: { is_blocked: blocked, reason } });
    revalidatePath(`/admin/customers/${id}`);
    revalidatePath("/admin/customers");
    revalidatePath("/admin/fraud");
    return { ok: true, message: blocked ? "Customer blocked" : "Customer unblocked" };
  } catch (e) {
    return fail(e);
  }
}
