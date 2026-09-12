import { PageHeader } from "@/components/admin/page-header";
import { schemaToFields } from "@/lib/blocks/fields";
import { SETTINGS_KEYS, SETTINGS_REGISTRY } from "@/lib/settings-registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { SettingsTabs, type SettingsSection, type ZoneRow } from "./settings-tabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

/** Settings (BUILD_PROMPT §6.2): every section is a zod schema in settings-registry.ts rendered by SchemaForm. */
export default async function SettingsPage() {
  const admin = createAdminClient();
  const [{ data: rows }, { data: zones }] = await Promise.all([
    admin.from("settings").select("key, value").in("key", SETTINGS_KEYS),
    admin.from("shipping_zones").select("id, name, districts, is_active, shipping_rates(id, rate_bdt, free_above_bdt, estimated_days, position)").order("created_at"),
  ]);
  const current = new Map((rows ?? []).map((r) => [r.key, r.value]));
  const sections: SettingsSection[] = SETTINGS_KEYS.map((key) => {
    const def = SETTINGS_REGISTRY[key];
    const parsed = def.schema.safeParse(current.get(key) ?? {});
    let values = parsed.success ? (parsed.data as Record<string, unknown>) : ((current.get(key) as Record<string, unknown>) ?? {});
    if (key === "payments" && typeof values.sslcz_store_passwd === "string" && values.sslcz_store_passwd) values = { ...values, sslcz_store_passwd: "••••••••" };
    return { key, label: def.label, description: def.description, isPublic: def.is_public, fields: schemaToFields(def.schema), values };
  });
  const zoneRows: ZoneRow[] = (zones ?? []).map((z) => {
    const r = [...((z.shipping_rates ?? []) as { id: string; rate_bdt: number; free_above_bdt: number | null; estimated_days: string | null; position: number }[])].sort((a, b) => a.position - b.position)[0];
    return { id: z.id, name: z.name, districts: z.districts ?? [], is_active: z.is_active, rate_bdt: r?.rate_bdt ?? 0, free_above_bdt: r?.free_above_bdt ?? null, estimated_days: r?.estimated_days ?? "" };
  });
  return (
    <>
      <PageHeader title="Settings" description="Store info, delivery zones and rates, payment gateway, SMS and email templates, language, OTP limits. Fraud thresholds live under Fraud rules; analytics ids under SEO Center." />
      <SettingsTabs sections={sections} zones={zoneRows} />
    </>
  );
}
