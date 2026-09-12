import { z } from "zod";

/** Navigation item form (PART2 §13.4 main menu / mega-menu builder). Admin form is derived from this. */
export const megaLinkSchema = z.object({
  label: z.string().min(1).max(60),
  link_type: z.enum(["url", "category", "collection", "product", "page", "search"]).default("category"),
  link_target: z.string().max(300).default("").describe("Slug for category/collection/product, or a URL"),
});

export const megaLayoutSchema = z.object({
  columns: z
    .array(z.object({ heading: z.string().max(40).default(""), links: z.array(megaLinkSchema).max(12).default([]) }))
    .max(4)
    .default([]),
  featured: z
    .object({
      image_url: z.string().max(500).default(""),
      heading: z.string().max(60).default(""),
      href: z.string().max(300).default(""),
    })
    .default({ image_url: "", heading: "", href: "" }),
});

export const navItemSchema = z.object({
  label_en: z.string().min(1).max(60),
  label_bn: z.string().max(60).optional().or(z.literal("")),
  link_type: z.enum(["url", "category", "collection", "product", "page", "search"]).default("category"),
  link_target: z.string().max(300).default("").describe("Slug for category/collection/product, or a URL for url"),
  icon: z.string().max(40).optional().or(z.literal("")).describe("lucide icon name (mobile menu)"),
  badge_label: z.string().max(16).optional().or(z.literal("")),
  badge_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal("")),
  opens_new_tab: z.boolean().default(false),
  is_mega: z.boolean().default(false).describe("Render a mega-menu panel under this item (top level only)"),
  mega_layout: megaLayoutSchema.default({ columns: [], featured: { image_url: "", heading: "", href: "" } }),
});

export type NavItemValues = z.output<typeof navItemSchema>;

export interface NavTreeNode extends NavItemValues {
  id: string;
  children: NavTreeNode[];
}

export const MENU_HANDLES = ["main", "mobile", "topbar", "footer_col_1", "footer_col_2", "footer_col_3", "footer_col_4"] as const;
