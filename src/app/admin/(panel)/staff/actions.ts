"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin, type AdminRole } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

type R<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };
const fail = (e: unknown): R<never> => ({ ok: false, error: e instanceof Error ? e.message : String(e) });
const roleSchema = z.enum(["owner", "manager", "staff"]);

/**
 * Invite (BUILD_PROMPT §6.2 Staff): owner-only. Creates the auth user with a
 * one-time password that is shown once; the invitee changes it after signing in.
 * Email delivery of invites is a go-live item (no email provider in the prototype).
 */
export async function inviteAdminAction(raw: unknown): Promise<R<{ tempPassword: string }>> {
  try {
    const s = await requireAdmin("owner");
    const p = z.object({ email: z.string().trim().email().max(200), full_name: z.string().trim().min(1).max(80), role: roleSchema }).parse(raw);
    const admin = createAdminClient();
    const email = p.email.toLowerCase();
    const tempPassword = `vg-${randomBytes(6).toString("base64url")}`;
    let userId: string | null = null;
    const { data, error } = await admin.auth.admin.createUser({ email, password: tempPassword, email_confirm: true, user_metadata: { full_name: p.full_name }, app_metadata: { admin: true } });
    if (error) {
      // existing auth user (e.g. a customer with that email): reuse it and reset the password
      for (let page = 1; page < 20 && !userId; page++) {
        const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        const hit = list?.users.find((u) => u.email?.toLowerCase() === email);
        if (hit) userId = hit.id;
        if (!list || list.users.length < 1000) break;
      }
      if (!userId) return { ok: false, error: error.message };
      await admin.auth.admin.updateUserById(userId, { password: tempPassword, email_confirm: true });
    } else userId = data.user.id;
    const { error: aErr } = await admin.from("admin_users").upsert({ id: userId, email, full_name: p.full_name, role: p.role, is_active: true }, { onConflict: "id" });
    if (aErr) return { ok: false, error: aErr.message };
    await audit(s, "staff.invite", { type: "admin_user", id: userId, after: { email, role: p.role } });
    revalidatePath("/admin/staff");
    return { ok: true, data: { tempPassword }, message: `${email} added as ${p.role}` };
  } catch (e) {
    return fail(e);
  }
}

export async function setAdminRoleAction(idRaw: string, roleRaw: string): Promise<R> {
  try {
    const s = await requireAdmin("owner");
    const id = z.string().uuid().parse(idRaw);
    const role = roleSchema.parse(roleRaw) as AdminRole;
    if (id === s.userId && role !== "owner") return { ok: false, error: "You cannot demote yourself" };
    const admin = createAdminClient();
    const { data: before } = await admin.from("admin_users").select("role").eq("id", id).single();
    const { error } = await admin.from("admin_users").update({ role }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    await audit(s, "staff.role", { type: "admin_user", id, before, after: { role } });
    revalidatePath("/admin/staff");
    return { ok: true, message: `Role set to ${role}` };
  } catch (e) {
    return fail(e);
  }
}

export async function setAdminActiveAction(idRaw: string, active: boolean): Promise<R> {
  try {
    const s = await requireAdmin("owner");
    const id = z.string().uuid().parse(idRaw);
    if (id === s.userId && !active) return { ok: false, error: "You cannot deactivate yourself" };
    const { error } = await createAdminClient().from("admin_users").update({ is_active: active }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    await audit(s, active ? "staff.activate" : "staff.deactivate", { type: "admin_user", id });
    revalidatePath("/admin/staff");
    return { ok: true, message: active ? "Reactivated" : "Deactivated (sessions lose admin access immediately)" };
  } catch (e) {
    return fail(e);
  }
}

export async function resetAdminPasswordAction(idRaw: string): Promise<R<{ tempPassword: string }>> {
  try {
    const s = await requireAdmin("owner");
    const id = z.string().uuid().parse(idRaw);
    const tempPassword = `vg-${randomBytes(6).toString("base64url")}`;
    const { error } = await createAdminClient().auth.admin.updateUserById(id, { password: tempPassword });
    if (error) return { ok: false, error: error.message };
    await audit(s, "staff.password_reset", { type: "admin_user", id });
    return { ok: true, data: { tempPassword }, message: "Temporary password generated" };
  } catch (e) {
    return fail(e);
  }
}
