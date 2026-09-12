import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type CourierSpeed = "instant" | "fast" | "realistic";

export interface DemoSettings {
  sms_failure_rate: number;
  courier_speed: CourierSpeed;
  courier_outage: boolean;
  force_return_next: boolean;
  courier_balance: number;
  fraud_score_override: number | null;
  clock_offset_days: number;
}

export const DEMO_DEFAULTS: DemoSettings = {
  sms_failure_rate: 0.05,
  courier_speed: "fast",
  courier_outage: false,
  force_return_next: false,
  courier_balance: 25000,
  fraud_score_override: null,
  clock_offset_days: 0,
};

/** Typed accessors over the demo_settings table (service-role only). */
export async function getDemoSetting<K extends keyof DemoSettings>(key: K): Promise<DemoSettings[K]> {
  const { data } = await createAdminClient().from("demo_settings").select("value").eq("key", key).maybeSingle();
  if (!data) return DEMO_DEFAULTS[key];
  return data.value as DemoSettings[K];
}

export async function getDemoSettings(): Promise<DemoSettings> {
  const { data } = await createAdminClient().from("demo_settings").select("key, value");
  const out: DemoSettings = { ...DEMO_DEFAULTS };
  for (const row of data ?? []) {
    if (row.key in out) (out as unknown as Record<string, unknown>)[row.key] = row.value;
  }
  return out;
}

export async function setDemoSetting<K extends keyof DemoSettings>(key: K, value: DemoSettings[K]): Promise<void> {
  const { error } = await createAdminClient()
    .from("demo_settings")
    .upsert({ key, value: value as never }, { onConflict: "key" });
  if (error) throw new Error(`demo_settings upsert failed: ${error.message}`);
}

export async function setDemoSettings(patch: Partial<DemoSettings>): Promise<DemoSettings> {
  for (const [k, v] of Object.entries(patch)) {
    await setDemoSetting(k as keyof DemoSettings, v as never);
  }
  return getDemoSettings();
}
