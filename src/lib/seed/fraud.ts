import "server-only";

import { BLOCKED_DEMO_PHONE } from "@/lib/demo/known-phones";
import { DEFAULT_FRAUD_RULES } from "@/lib/fraud/score";
import { toE164BD } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Fraud rules (BUILD_PROMPT §4.6) and one blocked demo phone (PART3 §20.4:
 * "one that's outright blocked"). Idempotent: rules are upserted by key but
 * score_delta / is_active edits made in the admin are preserved.
 */
export async function seedFraud(): Promise<{ rules: number; blocked: number }> {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("fraud_rules").select("key");
  const have = new Set((existing ?? []).map((r) => r.key));
  const rows = DEFAULT_FRAUD_RULES.filter((r) => !have.has(r.key)).map((r, i) => ({ key: r.key, name: r.name, rule: r.rule as never, score_delta: r.score_delta, is_active: r.is_active, position: i }));
  if (rows.length) {
    const { error } = await admin.from("fraud_rules").insert(rows);
    if (error) throw new Error(`fraud_rules: ${error.message}`);
  }
  const { error: bErr } = await admin
    .from("blocked_entities")
    .upsert({ type: "phone", value: toE164BD(BLOCKED_DEMO_PHONE)!, reason: "Demo: repeated refused COD parcels (seeded)", expires_at: null }, { onConflict: "type,value" });
  if (bErr) throw new Error(`blocked_entities: ${bErr.message}`);
  console.log(`[seed] fraud: ${rows.length} rules inserted, ${have.size} kept, 1 blocked phone`);
  return { rules: rows.length, blocked: 1 };
}
