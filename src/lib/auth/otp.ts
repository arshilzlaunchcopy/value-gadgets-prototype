import "server-only";

import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { isDemoMode } from "@/lib/env";
import { getSms } from "@/lib/integrations/sms";
import { toE164BD } from "@/lib/phone";
import { renderSms } from "@/lib/sms/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureCustomerForPhone, signInAsPhone } from "./identity";

/**
 * Our own OTP flow over the otp_codes table (BUILD_PROMPT §8 limits):
 * max 3 per phone per hour, 10 per IP per hour, 60 s cooldown, block after
 * 5 failed verifications, 5-minute expiry. Codes are stored hashed.
 * Demo mode: the code is returned to the UI and 123456 is always accepted.
 */
export interface OtpSettings {
  ttl_min: number;
  per_phone_hour: number;
  per_ip_hour: number;
  cooldown_s: number;
  max_failed: number;
}

const DEFAULTS: OtpSettings = { ttl_min: 5, per_phone_hour: 3, per_ip_hour: 10, cooldown_s: 60, max_failed: 5 };
export const DEMO_OTP = "123456";

async function getOtpSettings(): Promise<OtpSettings> {
  const { data } = await createAdminClient().from("settings").select("value").eq("key", "otp").maybeSingle();
  return { ...DEFAULTS, ...((data?.value as Partial<OtpSettings> | null) ?? {}) };
}

function hashCode(code: string, phone: string): string {
  return createHash("sha256").update(`${code}:${phone}:${process.env.AUTH_PEPPER ?? ""}`).digest("hex");
}

export interface RequestOtpResult {
  ok: boolean;
  error?: string;
  /** seconds until another code may be requested */
  retryAfterSec?: number;
  expiresInSec?: number;
  /** demo mode only */
  debugCode?: string;
}

export async function requestOtp(input: { phone: string; ip?: string | null; userAgent?: string | null }): Promise<RequestOtpResult> {
  const phone = toE164BD(input.phone);
  if (!phone) return { ok: false, error: "Enter a valid Bangladeshi mobile number (01XXXXXXXXX)" };
  const admin = createAdminClient();
  const s = await getOtpSettings();
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();

  const { data: recent } = await admin.from("otp_codes").select("created_at, attempts, consumed_at").eq("phone", phone).gte("created_at", hourAgo).order("created_at", { ascending: false });
  const rows = recent ?? [];
  if (rows.some((r) => !r.consumed_at && r.attempts >= s.max_failed)) {
    return { ok: false, error: "Too many wrong attempts. Please try again later or contact support." };
  }
  if (rows.length >= s.per_phone_hour) return { ok: false, error: "Too many codes requested for this number. Try again in an hour." };
  const last = rows[0];
  if (last) {
    const since = (Date.now() - new Date(last.created_at).getTime()) / 1000;
    if (since < s.cooldown_s) return { ok: false, error: `Please wait ${Math.ceil(s.cooldown_s - since)} s before requesting another code`, retryAfterSec: Math.ceil(s.cooldown_s - since) };
  }
  if (input.ip) {
    const { count } = await admin.from("otp_codes").select("id", { count: "exact", head: true }).eq("ip", input.ip).gte("created_at", hourAgo);
    if ((count ?? 0) >= s.per_ip_hour) return { ok: false, error: "Too many requests from this network. Try again later." };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + s.ttl_min * 60_000).toISOString();
  const { data: row, error } = await admin
    .from("otp_codes")
    .insert({ phone, code_hash: hashCode(code, phone), expires_at: expiresAt, ip: input.ip ?? null, user_agent: input.userAgent?.slice(0, 300) ?? null })
    .select("id")
    .single();
  if (error) return { ok: false, error: "Could not create a code. Please try again." };

  const message = await renderSms("otp", { code, minutes: String(s.ttl_min) });
  const sent = await getSms().send(phone, message, "otp");
  if (!sent.ok) {
    await admin.from("otp_codes").delete().eq("id", row.id);
    return { ok: false, error: "The SMS could not be sent. Please try again." };
  }
  return { ok: true, expiresInSec: s.ttl_min * 60, retryAfterSec: s.cooldown_s, debugCode: isDemoMode() ? code : undefined };
}

export interface VerifyOtpResult {
  ok: boolean;
  error?: string;
  customerId?: string;
  isNew?: boolean;
}

export async function verifyOtp(input: { phone: string; code: string; cartId?: string | null }): Promise<VerifyOtpResult> {
  const phone = toE164BD(input.phone);
  const code = input.code.replace(/\D/g, "");
  if (!phone || code.length !== 6) return { ok: false, error: "Enter the 6-digit code" };
  const admin = createAdminClient();
  const s = await getOtpSettings();

  const { data: row } = await admin
    .from("otp_codes")
    .select("id, code_hash, attempts, expires_at")
    .eq("phone", phone)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row) return { ok: false, error: "This code has expired. Request a new one." };
  if (row.attempts >= s.max_failed) return { ok: false, error: "Too many wrong attempts. Request a new code." };

  const expected = Buffer.from(row.code_hash, "hex");
  const given = Buffer.from(hashCode(code, phone), "hex");
  const matches = expected.length === given.length && timingSafeEqual(expected, given);
  const demoBypass = isDemoMode() && code === DEMO_OTP;
  if (!matches && !demoBypass) {
    const attempts = row.attempts + 1;
    await admin.from("otp_codes").update({ attempts }).eq("id", row.id);
    const left = s.max_failed - attempts;
    return { ok: false, error: left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many wrong attempts. Request a new code." };
  }

  await admin.from("otp_codes").update({ consumed_at: new Date().toISOString(), attempts: row.attempts + 1 }).eq("id", row.id);
  const { id, created } = await ensureCustomerForPhone(phone);
  const { data: c } = await admin.from("customers").select("is_blocked, block_reason").eq("id", id).maybeSingle();
  if (c?.is_blocked) return { ok: false, error: "This number cannot place orders. Please contact support." };
  await signInAsPhone(phone, id);
  if (input.cartId) await admin.from("carts").update({ customer_id: id }).eq("id", input.cartId); // cart merge (§8.5)
  return { ok: true, customerId: id, isNew: created };
}
