import { z } from "zod";

/** Product editor payload (client-safe schemas; the Server Action re-validates with these). */
export const variantSchema = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().trim().min(2).max(40),
  option_name: z.string().trim().max(40).optional().or(z.literal("")),
  option_value: z.string().trim().max(60).optional().or(z.literal("")),
  price_bdt: z.number().int().min(0),
  compare_at_price_bdt: z.number().int().min(0).nullable().optional(),
  cost_bdt: z.number().int().min(0).nullable().optional(),
  stock_qty: z.number().int().min(0),
  low_stock_threshold: z.number().int().min(0).default(5),
  weight_grams: z.number().int().min(0).nullable().optional(),
  gtin: z.string().trim().max(14).regex(/^\d*$/, "digits only").optional().or(z.literal("")),
  mpn: z.string().trim().max(60).optional().or(z.literal("")),
  is_default: z.boolean().default(false),
});

const seoLocale = z.object({
  meta_title: z.string().max(120).optional().or(z.literal("")),
  meta_description: z.string().max(320).optional().or(z.literal("")),
  og_image_url: z.string().max(500).optional().or(z.literal("")),
  robots: z.string().max(40).default("index,follow"),
});

export const productSchema = z.object({
  id: z.string().uuid().optional(),
  title_en: z.string().trim().min(3).max(200),
  title_bn: z.string().trim().max(200).optional().or(z.literal("")),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/, "lowercase letters, digits, hyphens"),
  brand_id: z.string().uuid().nullable().optional(),
  short_description: z.string().trim().max(300).optional().or(z.literal("")),
  description_en: z.string().max(20000).optional().or(z.literal("")),
  description_bn: z.string().max(20000).optional().or(z.literal("")),
  specs: z.array(z.object({ label: z.string().trim().min(1).max(60), value: z.string().trim().max(200) })).max(40).default([]),
  highlights: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  is_featured: z.boolean().default(false),
  warranty_months: z.number().int().min(0).max(120).default(0),
  video_url: z.string().trim().max(300).optional().or(z.literal("")),
  variants: z.array(variantSchema).min(1).max(30),
  category_ids: z.array(z.string().uuid()).max(10).default([]),
  collection_ids: z.array(z.string().uuid()).max(10).default([]),
  seo: z.object({ en: seoLocale, bn: seoLocale }).optional(),
});
export type ProductPayload = z.infer<typeof productSchema>;
