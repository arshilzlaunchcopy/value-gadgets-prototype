import { describe, expect, it } from "vitest";
import { code128Modules, code128Values } from "@/lib/barcode/code128";
import { scoreEntity } from "@/lib/seo/audit";
import { productJsonLd } from "@/lib/seo/jsonld";
import { normalizePath } from "@/lib/seo/redirects";
import { applyTemplate, seoSettingsSchema } from "@/lib/seo/settings";
import type { ProductDetail } from "@/lib/catalog/queries";

describe("SEO helpers (BUILD_PROMPT §7)", () => {
  it("applies title templates with placeholders", () => {
    const seo = seoSettingsSchema.parse({});
    expect(applyTemplate(seo.title_template_product, { title: "UGREEN Hub", store: "Value Gadgets BD" })).toBe("UGREEN Hub — Price in Bangladesh | Value Gadgets BD");
    expect(applyTemplate(seo.title_template_category, { name: "Cables", store: "X" })).toBe("Cables — Buy Online in Bangladesh | X");
  });

  it("normalises paths for redirect lookup", () => {
    expect(normalizePath("/products/old-slug/?utm=1")).toBe("/products/old-slug");
    expect(normalizePath("/")).toBe("/");
  });

  it("scores completeness", () => {
    const base = { kind: "product" as const, id: "x", label: "x", path: "/p", title: "A good product title for search", titleSource: "explicit" as const, description: "A description that is long enough to read well in the results page, around one hundred characters.", descriptionSource: "explicit" as const, robots: "index,follow", hasOgImage: false, hasImage: true };
    expect(scoreEntity(base).score).toBe(100);
    expect(scoreEntity({ ...base, descriptionSource: "missing", description: "" }).score).toBe(70);
    expect(scoreEntity({ ...base, title: "" }).issues).toContain("No title");
  });

  it("builds a Product JSON-LD with offers, gtin and reviews", () => {
    const detail = {
      product: { id: "p1", slug: "hub", title_en: "Hub", title_bn: null, brand_name: "UGREEN", brand_slug: "ugreen", price_bdt: 3850, compare_at_bdt: 4500, in_stock: true, available_stock: 5, avg_rating: 4.6, review_count: 12, is_featured: true, published_at: null, image: null, description_en: "d", short_description: "Eight ports", specs: [], highlights: [], warranty_months: 12, video_url: null, updated_at: "2026-09-01T00:00:00Z" },
      variants: [{ id: "v1", sku: "UG-1", option_name: null, option_value: null, price_bdt: 3850, compare_at_price_bdt: 4500, available_qty: 5, low_stock_threshold: 5, is_default: true, position: 0, gtin: "6957303845118", mpn: null }],
      images: [{ id: "i", variant_id: null, position: 0, picture: { src: "https://cdn/x.jpg", alt: "Hub" } }],
      reviews: [{ id: "r", rating: 5, title: "Great", body: "Works", reviewer_name: "Rafi", is_verified_purchase: true, admin_reply: null, replied_at: null, created_at: "2026-09-01T00:00:00Z" }],
      category: null,
      related: [],
      shipping: [{ zone: "Dhaka", districts: ["Dhaka"], rate_bdt: 60, free_above_bdt: 2000, estimated_days: "1-2 days" }],
    } as unknown as ProductDetail;
    const ld = productJsonLd(detail, { name: "Store", tagline: "", phone: "", whatsapp: "", email: "", address: "", trade_license: "", tin: "", facebook: "", instagram: "", youtube: "", currency: "BDT" }, { gtin: "6957303845118" });
    expect(ld["@type"]).toBe("Product");
    expect(ld.gtin).toBe("6957303845118");
    const offers = ld.offers as Record<string, unknown>;
    expect(offers["@type"]).toBe("Offer");
    expect(offers.price).toBe(3850);
    expect(offers.priceCurrency).toBe("BDT");
    expect((ld.aggregateRating as Record<string, unknown>).reviewCount).toBe(12);
    expect(Array.isArray(ld.review)).toBe(true);
  });
});

describe("Code 128 barcode", () => {
  it("encodes with the right checksum and stop pattern", () => {
    const values = code128Values("VG7K2M9PQ4X");
    expect(values[0]).toBe(104); // Start B
    expect(values[values.length - 1]).toBe(106); // Stop
    // checksum: (104 + Σ value_i * i) mod 103
    const data = values.slice(1, -2);
    const sum = data.reduce((acc, v, i) => acc + v * (i + 1), 104) % 103;
    expect(values[values.length - 2]).toBe(sum);
    const modules = code128Modules("A");
    expect(modules.length).toBe(6 * 3 + 7); // start + data + check (6 each) + stop (7)
  });
});
