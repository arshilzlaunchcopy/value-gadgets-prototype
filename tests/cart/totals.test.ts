import { describe, expect, it } from "vitest";
import { pickZone, quoteShipping } from "@/lib/cart/totals";

const zones = [
  { name: "Dhaka City", districts: ["Dhaka"], rate_bdt: 60, free_above_bdt: 2000, estimated_days: "1-2 days" },
  { name: "Dhaka Suburb", districts: ["Gazipur", "Narayanganj"], rate_bdt: 100, free_above_bdt: 3000, estimated_days: "2-3 days" },
  { name: "Outside Dhaka", districts: [], rate_bdt: 130, free_above_bdt: null, estimated_days: "3-5 days" },
];

describe("shipping quote", () => {
  it("matches the district zone case-insensitively", () => {
    expect(pickZone(zones, "dhaka")?.name).toBe("Dhaka City");
    expect(pickZone(zones, "Gazipur")?.name).toBe("Dhaka Suburb");
  });
  it("falls back to the catch-all zone", () => {
    expect(pickZone(zones, "Sylhet")?.name).toBe("Outside Dhaka");
    expect(pickZone(zones, null)?.name).toBe("Outside Dhaka");
  });
  it("applies the free-above threshold with integer taka", () => {
    expect(quoteShipping(pickZone(zones, "Dhaka"), 1999)?.charge_bdt).toBe(60);
    expect(quoteShipping(pickZone(zones, "Dhaka"), 2000)?.charge_bdt).toBe(0);
    expect(quoteShipping(pickZone(zones, "Sylhet"), 99_999)?.charge_bdt).toBe(130);
  });
  it("free-shipping coupons zero the charge", () => {
    expect(quoteShipping(pickZone(zones, "Sylhet"), 500, true)?.charge_bdt).toBe(0);
  });
});
