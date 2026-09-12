import type { CourierScore } from "@/lib/integrations/fraud/types";

/**
 * Fraud scoring inputs (BUILD_PROMPT §4.6 + PART2 §14.5). Pure function so the
 * seed engine and the order path share one implementation. Thresholds are
 * settings in production; defaults here.
 */
export interface FraudInput {
  paymentMethod: "cod" | "sslcommerz";
  totalBdt: number;
  isFirstOrder: boolean;
  priorOrders: number;
  priorCancelledOrReturned: number;
  ordersFromIpLastHour: number;
  phoneHasBlockedOrder: boolean;
  districtServiced: boolean;
  /** Local hour (Asia/Dhaka) the order was placed */
  placedHour: number;
  courierScore: CourierScore | null;
  /** true when the courier score lookup timed out / errored */
  courierScoreUnavailable?: boolean;
}

export interface FraudResult {
  score: number;
  flags: string[];
  /** 30-59 review; >= 60 review + advance payment (PART2 §14.3) */
  needsReview: boolean;
  needsAdvance: boolean;
}

export const FRAUD_THRESHOLDS = { review: 30, advance: 60, reverifyOtp: 80 } as const;

export function calculateFraudScore(i: FraudInput): FraudResult {
  let score = 0;
  const flags: string[] = [];
  const add = (points: number, flag: string) => {
    score += points;
    flags.push(`${flag} (${points > 0 ? "+" : ""}${points})`);
  };

  if (i.priorOrders >= 3 && i.priorCancelledOrReturned / i.priorOrders > 0.4) add(30, "cancel/return ratio > 40%");
  if (i.isFirstOrder && i.paymentMethod === "cod" && i.totalBdt > 5000) add(20, "first COD order above 5,000");
  if (i.ordersFromIpLastHour >= 3) add(25, "3+ orders from same IP in 1h");
  if (i.phoneHasBlockedOrder) add(50, "phone has a blocked order");
  if (!i.districtServiced) add(15, "district outside service area");
  if (i.placedHour >= 1 && i.placedHour < 5) add(10, "placed between 01:00-05:00");

  if (i.courierScoreUnavailable) {
    add(10, "courier score unavailable");
  } else if (i.courierScore) {
    const cs = i.courierScore;
    if (cs.fraudReportCount > 0) add(50, `${cs.fraudReportCount} courier fraud report(s)`);
    if (cs.totalParcels === 0 || cs.successRatio === null) add(10, "no courier history");
    else if (cs.successRatio >= 90) add(-20, `courier success ${cs.successRatio}%`);
    else if (cs.successRatio >= 70) add(0, `courier success ${cs.successRatio}%`);
    else if (cs.successRatio >= 50) add(20, `courier success ${cs.successRatio}%`);
    else add(40, `courier success ${cs.successRatio}%`);
  }

  score = Math.max(0, Math.min(100, score));
  return {
    score,
    flags,
    needsReview: score >= FRAUD_THRESHOLDS.review,
    needsAdvance: score >= FRAUD_THRESHOLDS.advance,
  };
}
