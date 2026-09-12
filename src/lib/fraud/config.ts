import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_FRAUD_RULES, FRAUD_THRESHOLDS, type FraudConfig, type FraudRule, type FraudRuleKey, type FraudThresholds } from "./score";

/**
 * Fraud configuration from the database: fraud_rules rows + settings.fraud_thresholds.
 * Missing rows fall back to the spec defaults, so a fresh database scores correctly
 * before the seed has run. Cheap enough to read per order (two indexed reads).
 */
export async function loadFraudConfig(): Promise<FraudConfig> {
  const admin = createAdminClient();
  const [{ data: rules }, { data: t }] = await Promise.all([
    admin.from("fraud_rules").select("key, name, score_delta, is_active, rule"),
    admin.from("settings").select("value").eq("key", "fraud_thresholds").maybeSingle(),
  ]);
  const known = new Set(DEFAULT_FRAUD_RULES.map((r) => r.key));
  const dbRules: FraudRule[] = (rules ?? [])
    .filter((r) => known.has(r.key as FraudRuleKey))
    .map((r) => ({ key: r.key as FraudRuleKey, name: r.name, score_delta: r.score_delta, is_active: r.is_active, rule: (r.rule ?? {}) as Record<string, number> }));
  const thresholds: FraudThresholds = { ...FRAUD_THRESHOLDS, ...((t?.value as Partial<FraudThresholds> | null) ?? {}) };
  return { rules: dbRules.length ? dbRules : DEFAULT_FRAUD_RULES, thresholds };
}

export interface ServiceArea {
  /** empty = every district is serviced */
  districts: string[];
}

export async function loadServiceArea(): Promise<ServiceArea> {
  const { data } = await createAdminClient().from("settings").select("value").eq("key", "service_area").maybeSingle();
  const v = (data?.value as { districts?: string[] } | null) ?? {};
  return { districts: Array.isArray(v.districts) ? v.districts : [] };
}

export function districtServiced(area: ServiceArea, district: string | null | undefined): boolean {
  if (area.districts.length === 0 || !district) return true;
  const d = district.trim().toLowerCase();
  return area.districts.some((x) => x.trim().toLowerCase() === d);
}
