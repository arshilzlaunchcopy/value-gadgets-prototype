import { normalizeBD } from "@/lib/phone";
import type { CourierScore, CourierScoreAdapter } from "./types";

/** FNV-1a 32-bit. Deterministic: the same phone always gets the same profile. */
export function hashPhone(phone: string): number {
  const s = normalizeBD(phone) ?? phone.replace(/\D/g, "");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Bucket boundaries from BUILD_PROMPT_PART3 §20.4 */
export type ScoreBucket = "new" | "good" | "mixed" | "risky" | "flagged";

export function bucketFor(phone: string): ScoreBucket {
  const b = hashPhone(phone) % 100;
  if (b < 10) return "new";
  if (b < 70) return "good";
  if (b < 88) return "mixed";
  if (b < 97) return "risky";
  return "flagged";
}

/** Pure function so the demo panel's reference table can use it without I/O. */
export function mockCourierScore(phone: string): CourierScore {
  const h = hashPhone(phone);
  const bucket = bucketFor(phone);
  // secondary hash bits for ranges, deterministic
  const r1 = (h >>> 8) % 1000;
  const r2 = (h >>> 18) % 1000;
  const lerp = (lo: number, hi: number, t: number) => lo + Math.round(((hi - lo) * t) / 999);

  let totalParcels = 0;
  let ratio: number | null = null;
  let fraudReportCount = 0;
  let riskLabel: CourierScore["riskLabel"] = "new";

  switch (bucket) {
    case "new":
      break;
    case "good":
      totalParcels = lerp(12, 60, r1);
      ratio = lerp(88, 98, r2);
      riskLabel = ratio >= 90 ? "trusted" : "good";
      break;
    case "mixed":
      totalParcels = lerp(5, 25, r1);
      ratio = lerp(60, 85, r2);
      riskLabel = "mixed";
      break;
    case "risky":
      totalParcels = lerp(4, 18, r1);
      ratio = lerp(30, 55, r2);
      riskLabel = "risky";
      break;
    case "flagged":
      totalParcels = lerp(3, 12, r1);
      ratio = lerp(5, 29, r2);
      fraudReportCount = lerp(1, 3, r1);
      riskLabel = "flagged";
      break;
  }

  const totalDelivered = ratio === null ? 0 : Math.round((totalParcels * ratio) / 100);
  return {
    phone: normalizeBD(phone) ?? phone,
    totalParcels,
    totalDelivered,
    totalCancelled: totalParcels - totalDelivered,
    successRatio: ratio,
    fraudReportCount,
    riskLabel,
    raw: { source: "mock", bucket, hash: h },
  };
}

/** MockCourierScoreAdapter - deterministic, not random (BUILD_PROMPT_PART3 §20.4). */
export class MockCourierScoreAdapter implements CourierScoreAdapter {
  readonly name = "mock-courier-score";
  readonly isMock = true;

  async check(phone: string): Promise<CourierScore> {
    await new Promise((r) => setTimeout(r, 150));
    return mockCourierScore(phone);
  }
}
