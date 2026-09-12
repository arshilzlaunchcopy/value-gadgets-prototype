import { z } from "zod";

/**
 * Theme settings (BUILD_PROMPT_PART2 §13.4 header builder, §13.5 footer builder).
 * One zod schema per theme_settings key; the admin forms are derived from these
 * with the same schemaToFields() the block system uses.
 */
export const announcementSchema = z.object({
  enabled: z.boolean().default(true),
  text_en: z.string().max(160).default("Free delivery inside Dhaka on orders over ৳2,000"),
  text_bn: z.string().max(160).optional().or(z.literal("")),
  href: z.string().max(300).optional().or(z.literal("")).describe("Optional link for the whole bar"),
  background_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#FFC107"),
  text_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#1A1A1A"),
  dismissible: z.boolean().default(true),
  visible_from: z.string().optional().or(z.literal("")).describe("ISO date-time; blank = now"),
  visible_until: z.string().optional().or(z.literal("")).describe("ISO date-time; blank = forever"),
});

export const headerSchema = z.object({
  logo_image: z.string().max(500).optional().or(z.literal("")).describe("Logo (SVG/PNG from the media library); blank = brand mark + name"),
  logo_height: z.number().int().min(24).max(64).default(36),
  mobile_logo_image: z.string().max(500).optional().or(z.literal("")),
  layout: z.enum(["logo_left", "logo_center"]).default("logo_left"),
  sticky: z.boolean().default(true),
  transparent_over_hero: z.boolean().default(false),
  show_search: z.boolean().default(true),
  show_cart: z.boolean().default(true),
  show_track_order: z.boolean().default(true),
  show_phone: z.boolean().default(false),
  show_language_switcher: z.boolean().default(false),
  mobile_bottom_tab_bar: z.boolean().default(true).describe("Home / Categories / Search / Cart / Account tabs on phones"),
});

export const footerSchema = z.object({
  columns: z
    .array(
      z.object({
        heading_en: z.string().min(1).max(40),
        menu_handle: z.string().min(1).max(40).describe("navigation_menus.handle, e.g. footer_col_1"),
      }),
    )
    .min(1)
    .max(4)
    .default([{ heading_en: "Shop", menu_handle: "footer_col_1" }, { heading_en: "Help", menu_handle: "footer_col_2" }]),
  about_text_en: z.string().max(300).optional().or(z.literal("")),
  show_contact_block: z.boolean().default(true),
  trade_license: z.string().max(80).optional().or(z.literal("")).describe("Shown in the footer (SSLCommerz requirement)"),
  tin: z.string().max(40).optional().or(z.literal("")),
  payment_badge_images: z.array(z.string().max(500)).max(8).default([]).describe("Payment method badge images"),
  show_newsletter: z.boolean().default(false),
  copyright_en: z.string().max(160).default("© {year} {store}. All rights reserved."),
});

export const brandSchema = z.object({
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#FFC107"),
  ink_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#1A1A1A"),
  bangla_numerals: z.boolean().default(false).describe("Show prices as ৳১,২৫০"),
});

export const THEME_SCHEMAS = {
  announcement: announcementSchema,
  header: headerSchema,
  footer: footerSchema,
  brand: brandSchema,
} as const;

export type ThemeKey = keyof typeof THEME_SCHEMAS;
export type Announcement = z.output<typeof announcementSchema>;
export type HeaderSettings = z.output<typeof headerSchema>;
export type FooterSettings = z.output<typeof footerSchema>;
export type BrandSettings = z.output<typeof brandSchema>;

export interface Theme {
  announcement: Announcement;
  header: HeaderSettings;
  footer: FooterSettings;
  brand: BrandSettings;
}

export function parseTheme(rows: { key: string; value: unknown }[]): Theme {
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    announcement: announcementSchema.parse(map.get("announcement") ?? {}),
    header: headerSchema.parse(map.get("header") ?? {}),
    footer: footerSchema.parse(map.get("footer") ?? {}),
    brand: brandSchema.parse(map.get("brand") ?? {}),
  };
}
