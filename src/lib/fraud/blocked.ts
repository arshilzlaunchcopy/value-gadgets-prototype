import "server-only";

import { normalizeBD, toE164BD } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";

export type BlockedType = "phone" | "ip" | "email" | "device";

export interface BlockHit {
  type: BlockedType;
  value: string;
  reason: string | null;
}

/**
 * blocked_entities lookup (BUILD_PROMPT §4.6). Phones match in both E.164 and
 * local form so an admin can paste either. Expired blocks are ignored.
 */
export async function findBlocks(input: { phone?: string | null; ip?: string | null; email?: string | null; device?: string | null }): Promise<BlockHit[]> {
  const values: { type: BlockedType; value: string }[] = [];
  if (input.phone) {
    const e164 = toE164BD(input.phone);
    const local = normalizeBD(input.phone);
    for (const v of [e164, local, input.phone.trim()]) if (v) values.push({ type: "phone", value: v });
  }
  if (input.ip) values.push({ type: "ip", value: input.ip.trim() });
  if (input.email) values.push({ type: "email", value: input.email.trim().toLowerCase() });
  if (input.device) values.push({ type: "device", value: input.device.trim() });
  if (values.length === 0) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("blocked_entities")
    .select("type, value, reason, expires_at")
    .in("value", [...new Set(values.map((v) => v.value))])
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  const wanted = new Set(values.map((v) => `${v.type}:${v.value}`));
  return (data ?? []).filter((r) => wanted.has(`${r.type}:${r.value}`)).map((r) => ({ type: r.type as BlockedType, value: r.value, reason: r.reason }));
}

/** True when the phone appears in blocked_entities (any form) or on a fraud-cancelled order. */
export async function phoneHasBlockHistory(phoneE164: string): Promise<boolean> {
  const admin = createAdminClient();
  const local = normalizeBD(phoneE164);
  const [{ count: blocked }, { count: fraudCancelled }] = await Promise.all([
    admin.from("blocked_entities").select("id", { count: "exact", head: true }).eq("type", "phone").in("value", [phoneE164, local ?? phoneE164]),
    admin.from("orders").select("id", { count: "exact", head: true }).eq("customer_phone", phoneE164).eq("status", "cancelled").ilike("admin_note", "%fraud%"),
  ]);
  return (blocked ?? 0) > 0 || (fraudCancelled ?? 0) > 0;
}
