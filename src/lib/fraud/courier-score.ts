import "server-only";

import { getCourierScore } from "@/lib/integrations/fraud";
import type { CourierScore } from "@/lib/integrations/fraud/types";
import { normalizeBD } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";

const TIMEOUT_MS = 5000;
const CACHE_DAYS = 7;

/**
 * Courier score with the PART2 §14.5 guardrails: server-side only, 7-day cache
 * in courier_score_cache, 5-second timeout, never blocks checkout.
 */
export async function getCachedCourierScore(phone: string): Promise<{ score: CourierScore | null; unavailable: boolean }> {
  const admin = createAdminClient();
  const local = normalizeBD(phone) ?? phone;
  const { data: cached } = await admin.from("courier_score_cache").select("*").eq("phone", local).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (cached) {
    return {
      score: {
        phone: local,
        totalParcels: cached.total_parcels,
        totalDelivered: cached.total_delivered,
        totalCancelled: cached.total_cancelled,
        successRatio: cached.success_ratio === null ? null : Number(cached.success_ratio),
        fraudReportCount: cached.fraud_report_count,
        riskLabel: labelFor(cached.success_ratio === null ? null : Number(cached.success_ratio), cached.fraud_report_count, cached.total_parcels),
        raw: cached.raw,
      },
      unavailable: false,
    };
  }

  const adapter = getCourierScore();
  try {
    const score = await Promise.race<CourierScore>([
      adapter.check(local),
      new Promise<CourierScore>((_, reject) => setTimeout(() => reject(new Error("courier score timeout")), TIMEOUT_MS)),
    ]);
    await admin.from("courier_score_cache").upsert(
      {
        phone: local,
        courier_code: adapter.name,
        total_parcels: score.totalParcels,
        total_delivered: score.totalDelivered,
        total_cancelled: score.totalCancelled,
        success_ratio: score.successRatio,
        fraud_report_count: score.fraudReportCount,
        raw: (score.raw ?? null) as never,
        checked_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + CACHE_DAYS * 86_400_000).toISOString(),
      },
      { onConflict: "phone" },
    );
    return { score, unavailable: false };
  } catch (err) {
    console.warn("[fraud] courier score unavailable:", err instanceof Error ? err.message : err);
    return { score: null, unavailable: true };
  }
}

function labelFor(ratio: number | null, fraudReports: number, parcels: number): CourierScore["riskLabel"] {
  if (fraudReports > 0) return "flagged";
  if (parcels === 0 || ratio === null) return "new";
  if (ratio >= 90) return "trusted";
  if (ratio >= 70) return "good";
  if (ratio >= 50) return "mixed";
  return "risky";
}
