import { describe, expect, it } from "vitest";
import { previewCoupon } from "@/lib/discounts/preview";
import { couponSchema } from "@/lib/discounts/schema";
import { SETTINGS_REGISTRY } from "@/lib/settings-registry";
import { schemaToFields } from "@/lib/blocks/fields";

const lines = [
  { product_id: "a", title: "Hub", unit_price_bdt: 3850, quantity: 1 },
  { product_id: "b", title: "Cable", unit_price_bdt: 650, quantity: 2 },
];

describe("coupon preview mirrors checkout rules (BUILD_PROMPT §6.2)", () => {
  it("percentage with a cap", () => {
    const r = previewCoupon({ type: "percentage", value: 15, min_order_bdt: 0, max_discount_bdt: 500, applies_all: true }, lines, 60);
    expect(r.subtotal_bdt).toBe(5150);
    expect(r.discount_bdt).toBe(500); // 772 capped at 500
    expect(r.total_bdt).toBe(4710);
  });
  it("fixed amount scoped to eligible products", () => {
    const r = previewCoupon({ type: "fixed", value: 1000, min_order_bdt: 0, max_discount_bdt: null, applies_all: false, eligible_product_ids: ["b"] }, lines, 60);
    expect(r.eligible_bdt).toBe(1300);
    expect(r.discount_bdt).toBe(1000);
  });
  it("free shipping and minimum order", () => {
    expect(previewCoupon({ type: "free_shipping", value: 0, min_order_bdt: 0, max_discount_bdt: null, applies_all: true }, lines, 130).shipping_bdt).toBe(0);
    expect(previewCoupon({ type: "percentage", value: 10, min_order_bdt: 10_000, max_discount_bdt: null, applies_all: true }, lines, 60).ok).toBe(false);
  });
  it("normalises the code", () => {
    expect(couponSchema.parse({ code: "eid15", type: "percentage", value: 15 }).code).toBe("EID15");
  });
});

describe("settings registry renders through schemaToFields", () => {
  it("derives fields for every key", () => {
    for (const [key, def] of Object.entries(SETTINGS_REGISTRY)) {
      const fields = schemaToFields(def.schema);
      expect(fields.length, key).toBeGreaterThan(0);
    }
    const sms = schemaToFields(SETTINGS_REGISTRY.sms_templates.schema);
    expect(sms.find((f) => f.name === "otp")?.kind).toBe("group");
    expect(schemaToFields(SETTINGS_REGISTRY.payments.schema).find((f) => f.name === "sslcz_sandbox")?.kind).toBe("boolean");
  });
});
