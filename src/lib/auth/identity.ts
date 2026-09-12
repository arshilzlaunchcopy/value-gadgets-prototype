import "server-only";

import { createHmac } from "node:crypto";
import { normalizeBD, toE164BD } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Phone identity on top of Supabase EMAIL auth (no SMS provider needed):
 *   email    = <local 11-digit>@PHONE_EMAIL_DOMAIN
 *   password = HMAC-SHA256(AUTH_PEPPER, E.164 phone)
 * The password is never shown to anyone; it exists so that a verified OTP can
 * be turned into a real Supabase session (RLS works natively afterwards).
 */
function domain(): string {
  return process.env.PHONE_EMAIL_DOMAIN ?? "phone.vgbd.local";
}

function pepper(): string {
  const p = process.env.AUTH_PEPPER;
  if (!p || p.length < 32) throw new Error("AUTH_PEPPER must be set (32+ chars)");
  return p;
}

export function emailForPhone(phone: string): string {
  const local = normalizeBD(phone);
  if (!local) throw new Error("invalid BD phone");
  return `${local}@${domain()}`.toLowerCase();
}

export function passwordForPhone(phone: string): string {
  const e164 = toE164BD(phone);
  if (!e164) throw new Error("invalid BD phone");
  return createHmac("sha256", pepper()).update(e164).digest("hex");
}

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

/** Find or create the auth user + customers row for a phone. */
export async function ensureCustomerForPhone(phone: string): Promise<{ id: string; created: boolean }> {
  const admin = createAdminClient();
  const e164 = toE164BD(phone);
  if (!e164) throw new Error("invalid BD phone");

  const { data: existing } = await admin.from("customers").select("id, is_blocked").eq("phone", e164).maybeSingle();
  if (existing) return { id: existing.id, created: false };

  const email = emailForPhone(e164);
  const password = passwordForPhone(e164);
  let userId: string | null = null;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { phone: e164 } });
  if (error) {
    // already registered (e.g. seeded) - reuse and make sure the password is the peppered one
    userId = await findAuthUserIdByEmail(email);
    if (!userId) throw new Error(`createUser: ${error.message}`);
    await admin.auth.admin.updateUserById(userId, { password });
  } else {
    userId = data.user.id;
  }

  const { error: cErr } = await admin.from("customers").upsert({ id: userId, phone: e164 }, { onConflict: "id" });
  if (cErr) throw new Error(`customers upsert: ${cErr.message}`);
  return { id: userId, created: !error };
}

/**
 * Turn a verified phone into a cookie session. Called only after OTP success.
 * Seeded users have random passwords, so a failed first sign-in resets the
 * password to the peppered value and retries once.
 */
export async function signInAsPhone(phone: string, userId: string): Promise<void> {
  const email = emailForPhone(phone);
  const password = passwordForPhone(phone);
  const supabase = await createClient();
  const first = await supabase.auth.signInWithPassword({ email, password });
  if (!first.error) return;
  await createAdminClient().auth.admin.updateUserById(userId, { password, email_confirm: true });
  const second = await supabase.auth.signInWithPassword({ email, password });
  if (second.error) throw new Error(`sign-in failed: ${second.error.message}`);
}
