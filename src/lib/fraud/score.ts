import type { CourierScore } from "@/lib/integrations/fraud/types";

/**
 * Fraud scoring (BUILD_PROMPT §4.6 + PART2 §14.5). Pure function so the seed
 * engine, tests and the order path share one implementation. Every rule's
 * points and on/off switch, and every threshold, come from the database
 * (fraud_rules + settings.fraud_thresholds); the constants here are defaults.
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

export type FraudRuleKey =
  | "cancel_ratio"
  | "first_cod_above"
  | "ip_velocity"
  | "phone_blocked"
  | "district_unserviced"
  | "night_hours"
  | "courier_unavailable"
  | "courier_fraud_reports"
  | "courier_new"
  | "courier_trusted"
  | "courier_mixed"
  | "courier_risky";

export interface FraudRule {
  key: FraudRuleKey;
  name: string;
  score_delta: number;
  is_active: boolean;
  rule: Record<string, number>;
}

/** Defaults straight from the spec. Seeded into fraud_rules; editable afterwards. */
export const DEFAULT_FRAUD_RULES: FraudRule[] = [
  { key: "cancel_ratio", name: "Cancelled/returned ratio above 40%", score_delta: 30, is_active: true, rule: { ratio: 0.4, min_orders: 3 } },
  { key: "first_cod_above", name: "First-time customer, COD above ৳5,000", score_delta: 20, is_active: true, rule: { amount_bdt: 5000 } },
  { key: "ip_velocity", name: "3+ orders from the same IP in one hour", score_delta: 25, is_active: true, rule: { orders: 3 } },
  { key: "phone_blocked", name: "Phone has a prior blocked order", score_delta: 50, is_active: true, rule: {} },
  { key: "district_unserviced", name: "Delivery district outside service area", score_delta: 15, is_active: true, rule: {} },
  { key: "night_hours", name: "Placed between 01:00 and 05:00", score_delta: 10, is_active: true, rule: { from_hour: 1, to_hour: 5 } },
  { key: "courier_unavailable", name: "Courier score lookup failed", score_delta: 10, is_active: true, rule: {} },
  { key: "courier_fraud_reports", name: "Courier fraud report(s) on this phone", score_delta: 50, is_active: true, rule: {} },
  { key: "courier_new", name: "No courier history", score_delta: 10, is_active: true, rule: {} },
  { key: "courier_trusted", name: "Courier success ratio 90%+", score_delta: -20, is_active: true, rule: { min_ratio: 90 } },
  { key: "courier_mixed", name: "Courier success ratio 50-69%", score_delta: 20, is_active: true, rule: { min_ratio: 50, max_ratio: 69 } },
  { key: "courier_risky", name: "Courier success ratio below 50%", score_delta: 40, is_active: true, rule: { max_ratio: 49 } },
];

export interface FraudThresholds {
  /** score at or above which the order waits in the Review Queue */
  review: number;
  /** score at or above which an advance payment is required before dispatch */
  advance: number;
  /** score at or above which the phone must be re-verified */
  reverify_otp: number;
  /** COD orders at or above this total are never auto-confirmed */
  cod_auto_confirm_max: number;
  /** trusted courier history raises the COD ceiling by this factor */
  trusted_cod_multiplier: number;
  /** auto-dispatch to the courier right after auto-confirmation */
  auto_dispatch: boolean;
}

export const FRAUD_THRESHOLDS: FraudThresholds = { review: 30, advance: 60, reverify_otp: 80, cod_auto_confirm_max: 3000, trusted_cod_multiplier: 2, auto_dispatch: true };

export interface FraudConfig {
  rules: FraudRule[];
  thresholds: FraudThresholds;
}

export const DEFAULT_FRAUD_CONFIG: FraudConfig = { rules: DEFAULT_FRAUD_RULES, thresholds: FRAUD_THRESHOLDS };

export interface FraudResult {
  score: number;
  flags: string[];
  /** rule keys that fired */
  fired: FraudRuleKey[];
  needsReview: boolean;
  needsAdvance: boolean;
  needsReverify: boolean;
  /** courier history says trusted (raises the COD ceiling) */
  courierTrusted: boolean;
}

export function calculateFraudScore(i: FraudInput, config: FraudConfig = DEFAULT_FRAUD_CONFIG): FraudResult {
  const t = { ...FRAUD_THRESHOLDS, ...config.thresholds };
  const byKey = new Map<FraudRuleKey, FraudRule>();
  for (const r of DEFAULT_FRAUD_RULES) byKey.set(r.key, r);
  for (const r of config.rules) byKey.set(r.key, { ...byKey.get(r.key)!, ...r, rule: { ...byKey.get(r.key)?.rule, ...r.rule } });

  let score = 0;
  const flags: string[] = [];
  const fired: FraudRuleKey[] = [];
  let courierTrusted = false;
  const add = (key: FraudRuleKey, detail?: string) => {
    const r = byKey.get(key)!;
    if (!r.is_active) return;
    score += r.score_delta;
    fired.push(key);
    flags.push(`${detail ?? r.name} (${r.score_delta > 0 ? "+" : ""}${r.score_delta})`);
  };
  const p = (key: FraudRuleKey) => byKey.get(key)!.rule;

  if (i.priorOrders >= (p("cancel_ratio").min_orders ?? 3) && i.priorCancelledOrReturned / i.priorOrders > (p("cancel_ratio").ratio ?? 0.4)) add("cancel_ratio", "cancel/return ratio above limit");
  if (i.isFirstOrder && i.paymentMethod === "cod" && i.totalBdt > (p("first_cod_above").amount_bdt ?? 5000)) add("first_cod_above", `first COD order above ${p("first_cod_above").amount_bdt ?? 5000}`);
  if (i.ordersFromIpLastHour >= (p("ip_velocity").orders ?? 3)) add("ip_velocity", `${i.ordersFromIpLastHour} orders from same IP in 1h`);
  if (i.phoneHasBlockedOrder) add("phone_blocked");
  if (!i.districtServiced) add("district_unserviced");
  if (i.placedHour >= (p("night_hours").from_hour ?? 1) && i.placedHour < (p("night_hours").to_hour ?? 5)) add("night_hours", `placed at ${String(i.placedHour).padStart(2, "0")}:xx`);

  if (i.courierScoreUnavailable) {
    add("courier_unavailable");
  } else if (i.courierScore) {
    const cs = i.courierScore;
    if (cs.fraudReportCount > 0) add("courier_fraud_reports", `${cs.fraudReportCount} courier fraud report(s)`);
    if (cs.totalParcels === 0 || cs.successRatio === null) add("courier_new");
    else if (cs.successRatio >= (p("courier_trusted").min_ratio ?? 90)) {
      add("courier_trusted", `courier success ${cs.successRatio}%`);
      courierTrusted = byKey.get("courier_trusted")!.is_active;
    } else if (cs.successRatio >= 70) flags.push(`courier success ${cs.successRatio}% (0)`);
    else if (cs.successRatio >= (p("courier_mixed").min_ratio ?? 50)) add("courier_mixed", `courier success ${cs.successRatio}%`);
    else add("courier_risky", `courier success ${cs.successRatio}%`);
  }

  score = Math.max(0, Math.min(100, score));
  return {
    score,
    flags,
    fired,
    needsReview: score >= t.review,
    needsAdvance: score >= t.advance,
    needsReverify: score >= t.reverify_otp,
    courierTrusted,
  };
}

export type OrderPath = "auto_confirm" | "review" | "review_advance";

export interface OrderDecision {
  path: OrderPath;
  /** initial orders.status for a COD order (online orders always start pending_payment) */
  codStatus: "confirmed" | "awaiting_advance";
  needsReview: boolean;
  needsAdvance: boolean;
  needsReverify: boolean;
  autoDispatch: boolean;
  reasons: string[];
}

/**
 * PART2 §14.3 dispatch flow:
 *   score < review AND paid online          -> auto-confirm -> auto-dispatch
 *   score < review AND COD < ceiling        -> auto-confirm -> auto-dispatch
 *   review <= score < advance               -> Review Queue
 *   score >= advance                        -> Review Queue + advance payment
 * A trusted courier history raises the COD ceiling (§14.5).
 */
export function decideOrderPath(fraud: FraudResult, i: { paymentMethod: "cod" | "sslcommerz"; totalBdt: number }, thresholds: FraudThresholds = FRAUD_THRESHOLDS): OrderDecision {
  const t = { ...FRAUD_THRESHOLDS, ...thresholds };
  const reasons: string[] = [];
  const ceiling = fraud.courierTrusted ? t.cod_auto_confirm_max * t.trusted_cod_multiplier : t.cod_auto_confirm_max;
  let needsReview = fraud.needsReview;
  if (needsReview) reasons.push(`fraud score ${fraud.score} >= ${t.review}`);
  if (!needsReview && i.paymentMethod === "cod" && i.totalBdt >= ceiling) {
    needsReview = true;
    reasons.push(`COD total ${i.totalBdt} >= auto-confirm ceiling ${ceiling}`);
  }
  const needsAdvance = fraud.needsAdvance;
  if (needsAdvance) reasons.push(`fraud score ${fraud.score} >= ${t.advance}: advance payment required`);
  const needsReverify = fraud.needsReverify;
  if (needsReverify) reasons.push(`fraud score ${fraud.score} >= ${t.reverify_otp}: phone re-verification required`);
  const path: OrderPath = needsAdvance ? "review_advance" : needsReview ? "review" : "auto_confirm";
  return {
    path,
    codStatus: needsAdvance ? "awaiting_advance" : "confirmed",
    needsReview,
    needsAdvance,
    needsReverify,
    autoDispatch: path === "auto_confirm" && t.auto_dispatch,
    reasons,
  };
}
