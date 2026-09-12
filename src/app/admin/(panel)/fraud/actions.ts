"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/admin";
import { NORMALIZED_STATUSES } from "@/lib/courier/webhook";
import { DEFAULT_FRAUD_RULES, type FraudThresholds } from "@/lib/fraud/score";
import { toE164BD } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";

type R = { ok: boolean; error?: string; message?: string };
const fail = (e: unknown): R => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

const blockSchema = z.object({
  type: z.enum(["phone", "ip", "email", "device"]),
  value: z.string().trim().min(3).max(200),
  reason: z.string().trim().max(300).optional().or(z.literal("")),
  expires_days: z.number().int().min(0).max(3650).nullable().optional(),
});

export async function addBlockAction(raw: unknown): Promise<R> {
  try {
    const s = await requireAdmin("manager");
    const b = blockSchema.parse(raw);
    let value = b.value;
    if (b.type === "phone") {
      const e164 = toE164BD(value);
      if (!e164) return { ok: false, error: "Enter a valid Bangladeshi phone number" };
      value = e164;
    }
    if (b.type === "email") value = value.toLowerCase();
    const expires_at = b.expires_days ? new Date(Date.now() + b.expires_days * 86_400_000).toISOString() : null;
    const { error } = await createAdminClient().from("blocked_entities").upsert({ type: b.type, value, reason: b.reason || null, blocked_by: s.userId, expires_at }, { onConflict: "type,value" });
    if (error) return { ok: false, error: error.message };
    if (b.type === "phone") await createAdminClient().from("customers").update({ is_blocked: true, block_reason: b.reason || "Blocked from fraud console" }).eq("phone", value);
    await audit(s, "fraud.block", { type: "blocked_entity", after: { type: b.type, value, reason: b.reason } });
    revalidatePath("/admin/fraud");
    return { ok: true, message: `${b.type} blocked` };
  } catch (e) {
    return fail(e);
  }
}

export async function removeBlockAction(id: string): Promise<R> {
  try {
    await requireAdmin("manager");
    const admin = createAdminClient();
    const { data } = await admin.from("blocked_entities").select("type, value").eq("id", z.string().uuid().parse(id)).maybeSingle();
    const { error } = await admin.from("blocked_entities").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    if (data?.type === "phone") await admin.from("customers").update({ is_blocked: false, block_reason: null }).eq("phone", data.value);
    revalidatePath("/admin/fraud");
    return { ok: true, message: "Unblocked" };
  } catch (e) {
    return fail(e);
  }
}

const ruleSchema = z.object({ key: z.string(), score_delta: z.number().int().min(-100).max(100), is_active: z.boolean(), rule: z.record(z.string(), z.number()).default({}) });

export async function saveRulesAction(rawRules: unknown): Promise<R> {
  try {
    await requireAdmin("manager");
    const rules = z.array(ruleSchema).parse(rawRules);
    const known = new Map(DEFAULT_FRAUD_RULES.map((r) => [r.key, r]));
    const admin = createAdminClient();
    for (const r of rules) {
      const def = known.get(r.key as never);
      if (!def) continue;
      const { error } = await admin.from("fraud_rules").upsert({ key: r.key, name: def.name, score_delta: r.score_delta, is_active: r.is_active, rule: r.rule as never }, { onConflict: "key" });
      if (error) return { ok: false, error: error.message };
    }
    revalidatePath("/admin/fraud");
    return { ok: true, message: "Rules saved" };
  } catch (e) {
    return fail(e);
  }
}

const thresholdsSchema = z.object({
  review: z.number().int().min(0).max(100),
  advance: z.number().int().min(0).max(100),
  reverify_otp: z.number().int().min(0).max(100),
  cod_auto_confirm_max: z.number().int().min(0).max(10_000_000),
  trusted_cod_multiplier: z.number().min(1).max(10),
  auto_dispatch: z.boolean(),
});

export async function saveThresholdsAction(raw: unknown, serviceDistrictsRaw: string): Promise<R> {
  try {
    const s = await requireAdmin("manager");
    const t: FraudThresholds = thresholdsSchema.parse(raw);
    if (t.review > t.advance || t.advance > t.reverify_otp) return { ok: false, error: "Thresholds must be ordered: review ≤ advance ≤ re-verify" };
    const districts = serviceDistrictsRaw.split(/[\n,]/).map((d) => d.trim()).filter(Boolean);
    const admin = createAdminClient();
    const a = await admin.from("settings").upsert({ key: "fraud_thresholds", value: t as never, is_public: false, updated_by: s.userId }, { onConflict: "key" });
    const b = await admin.from("settings").upsert({ key: "service_area", value: { districts } as never, is_public: false, updated_by: s.userId }, { onConflict: "key" });
    if (a.error || b.error) return { ok: false, error: (a.error ?? b.error)!.message };
    await audit(s, "settings.fraud_thresholds", { type: "settings", after: { ...t, districts } });
    revalidatePath("/admin/fraud");
    return { ok: true, message: "Thresholds saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function saveStatusMapAction(rawText: string): Promise<R> {
  try {
    const s = await requireAdmin("manager");
    const map: Record<string, string> = {};
    for (const line of rawText.split("\n")) {
      const [k, v] = line.split(/[=:]/).map((x) => x?.trim().toLowerCase());
      if (!k || !v) continue;
      if (!NORMALIZED_STATUSES.includes(v as never)) return { ok: false, error: `"${v}" is not a normalized status (${NORMALIZED_STATUSES.join(", ")})` };
      map[k] = v;
    }
    const { error } = await createAdminClient().from("settings").upsert({ key: "courier_status_map", value: map as never, is_public: false, updated_by: s.userId }, { onConflict: "key" });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/fraud");
    return { ok: true, message: `${Object.keys(map).length} mapping(s) saved` };
  } catch (e) {
    return fail(e);
  }
}
