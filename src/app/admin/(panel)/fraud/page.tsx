import { PageHeader } from "@/components/admin/page-header";
import { STATUS_MAP } from "@/lib/courier/webhook";
import { loadFraudConfig, loadServiceArea } from "@/lib/fraud/config";
import { DEFAULT_FRAUD_RULES } from "@/lib/fraud/score";
import { createAdminClient } from "@/lib/supabase/admin";
import { FraudConsole } from "./fraud-console";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fraud & courier rules" };

export default async function FraudPage() {
  const admin = createAdminClient();
  const [config, area, { data: blocked }, { data: statusMap }, { count: queue }] = await Promise.all([
    loadFraudConfig(),
    loadServiceArea(),
    admin.from("blocked_entities").select("id, type, value, reason, expires_at, created_at").order("created_at", { ascending: false }).limit(200),
    admin.from("settings").select("value").eq("key", "courier_status_map").maybeSingle(),
    admin.from("orders").select("id", { count: "exact", head: true }).eq("needs_review", true).not("status", "in", "(cancelled,delivered,returned,refunded)"),
  ]);
  const byKey = new Map(config.rules.map((r) => [r.key, r]));
  const rules = DEFAULT_FRAUD_RULES.map((d) => ({ ...d, ...(byKey.get(d.key) ?? {}), name: d.name }));
  const custom = (statusMap?.value ?? {}) as Record<string, string>;

  return (
    <>
      <PageHeader title="Fraud & courier rules" description={`Every point value and threshold is editable here, nothing is a constant. ${queue ?? 0} order(s) currently in the review queue.`} />
      <FraudConsole
        rules={rules}
        thresholds={config.thresholds}
        serviceDistricts={area.districts}
        blocked={(blocked ?? []).map((b) => ({ id: b.id, type: b.type, value: b.value, reason: b.reason, expires_at: b.expires_at, created_at: b.created_at }))}
        statusMapDefaults={STATUS_MAP}
        statusMapCustom={custom}
      />
    </>
  );
}
