import { describe, expect, it } from "vitest";
import { formatMoney, toBanglaDigits } from "@/lib/i18n/format";
import { localizePath, MESSAGES, t } from "@/lib/i18n/messages";

describe("Bangla localisation (PART2 §15.3)", () => {
  it("has a Bangla string for every English key", () => {
    const missing = (Object.keys(MESSAGES.en) as (keyof typeof MESSAGES.en)[]).filter((k) => !MESSAGES.bn[k] || MESSAGES.bn[k] === MESSAGES.en[k]);
    expect(missing).toEqual([]);
  });

  it("interpolates placeholders in both languages", () => {
    expect(t("en", "pdp.warranty_months", { n: 12 })).toBe("12-month warranty");
    expect(t("bn", "pdp.warranty_months", { n: 12 })).toBe("12 মাসের ওয়ারেন্টি");
    expect(t("bn", "order.title", { n: "VGBD-1" })).toContain("VGBD-1");
  });

  it("renders Bangla numerals only when enabled and the locale is bn", () => {
    expect(formatMoney(1250)).toBe("৳1,250");
    expect(formatMoney(1250, { locale: "bn", banglaNumerals: false })).toBe("৳1,250");
    expect(formatMoney(1250, { locale: "bn", banglaNumerals: true })).toBe("৳১,২৫০");
    expect(formatMoney(1250000, { locale: "bn", banglaNumerals: true })).toBe("৳১২,৫০,০০০"); // lakh grouping kept
    expect(toBanglaDigits("2026-09-13")).toBe("২০২৬-০৯-১৩");
  });

  it("localises paths: bn is prefixed, en is bare", () => {
    expect(localizePath("/products/x", "bn")).toBe("/bn/products/x");
    expect(localizePath("/bn/products/x", "en")).toBe("/products/x");
    expect(localizePath("/", "bn")).toBe("/bn");
    expect(localizePath("/bn", "en")).toBe("/");
  });
});
