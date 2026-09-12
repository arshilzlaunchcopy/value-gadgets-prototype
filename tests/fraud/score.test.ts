import { describe, expect, it } from "vitest";
import { calculateFraudScore, DEFAULT_FRAUD_CONFIG, decideOrderPath, type FraudInput } from "@/lib/fraud/score";
import { mockCourierScore } from "@/lib/integrations/fraud/mock";
import { KNOWN_PHONES } from "@/lib/demo/known-phones";
import { buildDispatchPayload } from "@/lib/orders/dispatch";

const base: FraudInput = {
  paymentMethod: "cod",
  totalBdt: 1500,
  isFirstOrder: false,
  priorOrders: 5,
  priorCancelledOrReturned: 0,
  ordersFromIpLastHour: 1,
  phoneHasBlockedOrder: false,
  districtServiced: true,
  placedHour: 14,
  courierScore: null,
};

describe("calculateFraudScore (BUILD_PROMPT §4.6, PART2 §14.5)", () => {
  it("scores a clean repeat customer at 0 and auto-confirms", () => {
    const r = calculateFraudScore(base);
    expect(r.score).toBe(0);
    const d = decideOrderPath(r, { paymentMethod: "cod", totalBdt: 1500 });
    expect(d.path).toBe("auto_confirm");
    expect(d.autoDispatch).toBe(true);
  });

  it("adds the spec points per rule", () => {
    expect(calculateFraudScore({ ...base, priorOrders: 10, priorCancelledOrReturned: 5 }).score).toBe(30);
    expect(calculateFraudScore({ ...base, isFirstOrder: true, totalBdt: 6000 }).score).toBe(20);
    expect(calculateFraudScore({ ...base, ordersFromIpLastHour: 3 }).score).toBe(25);
    expect(calculateFraudScore({ ...base, phoneHasBlockedOrder: true }).score).toBe(50);
    expect(calculateFraudScore({ ...base, districtServiced: false }).score).toBe(15);
    expect(calculateFraudScore({ ...base, placedHour: 3 }).score).toBe(10);
    expect(calculateFraudScore({ ...base, courierScoreUnavailable: true }).score).toBe(10);
  });

  it("uses courier history: trusted -20, risky +40, fraud reports +50", () => {
    const trusted = KNOWN_PHONES.find((k) => k.label.startsWith("Excellent"))!;
    const risky = KNOWN_PHONES.find((k) => k.bucket === "risky")!;
    const flagged = KNOWN_PHONES.find((k) => k.bucket === "flagged")!;
    const t = calculateFraudScore({ ...base, placedHour: 3, courierScore: trusted.score });
    expect(t.score).toBe(0); // 10 - 20 clamps at 0
    expect(t.courierTrusted).toBe(true);
    expect(calculateFraudScore({ ...base, courierScore: risky.score }).score).toBe(40);
    expect(calculateFraudScore({ ...base, courierScore: flagged.score }).score).toBeGreaterThanOrEqual(90);
  });

  it("is deterministic per phone (PART3 §20.4)", () => {
    for (const k of KNOWN_PHONES) expect(mockCourierScore(k.phone)).toEqual(k.score);
  });

  it("respects admin-edited rules and thresholds", () => {
    const cfg = { rules: [{ ...DEFAULT_FRAUD_CONFIG.rules[5], is_active: false }], thresholds: { ...DEFAULT_FRAUD_CONFIG.thresholds, review: 5 } };
    const r = calculateFraudScore({ ...base, placedHour: 3, ordersFromIpLastHour: 3 }, cfg);
    expect(r.score).toBe(25); // night rule off
    expect(r.needsReview).toBe(true); // lowered threshold
  });
});

describe("decideOrderPath (PART2 §14.3)", () => {
  it("routes by score and COD ceiling", () => {
    const clean = calculateFraudScore(base);
    expect(decideOrderPath(clean, { paymentMethod: "cod", totalBdt: 2999 }).path).toBe("auto_confirm");
    expect(decideOrderPath(clean, { paymentMethod: "cod", totalBdt: 3000 }).path).toBe("review");
    expect(decideOrderPath(clean, { paymentMethod: "sslcommerz", totalBdt: 50_000 }).path).toBe("auto_confirm");
    const mid = calculateFraudScore({ ...base, priorOrders: 10, priorCancelledOrReturned: 5 });
    expect(decideOrderPath(mid, { paymentMethod: "cod", totalBdt: 500 }).path).toBe("review");
    const high = calculateFraudScore({ ...base, phoneHasBlockedOrder: true, ordersFromIpLastHour: 3 });
    const d = decideOrderPath(high, { paymentMethod: "cod", totalBdt: 500 });
    expect(d.path).toBe("review_advance");
    expect(d.codStatus).toBe("awaiting_advance");
  });

  it("doubles the COD ceiling for trusted courier history", () => {
    const trusted = KNOWN_PHONES.find((k) => k.label.startsWith("Excellent"))!;
    const r = calculateFraudScore({ ...base, courierScore: trusted.score });
    expect(decideOrderPath(r, { paymentMethod: "cod", totalBdt: 5500 }).path).toBe("auto_confirm");
    expect(decideOrderPath(r, { paymentMethod: "cod", totalBdt: 6000 }).path).toBe("review");
  });
});

describe("dispatch payload (PART2 §14.3)", () => {
  const order = { order_number: "VGBD-260913-AB12", customer_phone: "+8801712345678", customer_note: "Call first", payment_method: "sslcommerz", total_bdt: 4200, shipping_address: { recipient_name: "Rafi", street_address: "House 5", area: "Banani", upazila: "Gulshan", district: "Dhaka", division: "Dhaka" } };
  it("sends cod_amount 0 for prepaid orders and the local phone form", () => {
    const p = buildDispatchPayload(order, "1x Hub");
    expect(p.codAmountBdt).toBe(0);
    expect(p.recipientPhone).toBe("01712345678");
    expect(p.recipientAddress).toBe("House 5, Banani, Gulshan, Dhaka, Dhaka");
    expect(p.note).toBe("Call first | 1x Hub");
  });
  it("sends the full total for COD", () => {
    expect(buildDispatchPayload({ ...order, payment_method: "cod" }, "").codAmountBdt).toBe(4200);
  });
});
