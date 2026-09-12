import { z } from "zod";

const slug = z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/, "lowercase letters, digits, hyphens");

export const pageSchema = z.object({
  id: z.string().uuid().optional(),
  slug,
  title_en: z.string().trim().min(1).max(160),
  title_bn: z.string().trim().max(160).optional().or(z.literal("")),
  content_en: z.string().max(60000).optional().or(z.literal("")),
  content_bn: z.string().max(60000).optional().or(z.literal("")),
  is_published: z.boolean().default(true),
  show_in_footer: z.boolean().default(true),
  position: z.number().int().min(0).max(1000).default(0),
});
export type PageInput = z.input<typeof pageSchema>;
export type PagePayload = z.output<typeof pageSchema>;

export const postSchema = z.object({
  id: z.string().uuid().optional(),
  slug,
  title_en: z.string().trim().min(1).max(200),
  excerpt_en: z.string().trim().max(400).optional().or(z.literal("")),
  content_en: z.string().max(80000).optional().or(z.literal("")),
  title_bn: z.string().trim().max(200).optional().or(z.literal("")),
  excerpt_bn: z.string().trim().max(400).optional().or(z.literal("")),
  content_bn: z.string().max(80000).optional().or(z.literal("")),
  cover_image_url: z.string().trim().max(500).optional().or(z.literal("")),
  cover_alt: z.string().trim().max(200).optional().or(z.literal("")),
  author_name: z.string().trim().max(80).optional().or(z.literal("")),
  reading_minutes: z.number().int().min(1).max(60).default(3),
  status: z.enum(["draft", "published"]).default("draft"),
  related_product_ids: z.array(z.string().uuid()).max(8).default([]),
});
export type PostInput = z.input<typeof postSchema>;
export type PostPayload = z.output<typeof postSchema>;
