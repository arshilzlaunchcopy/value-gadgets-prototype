import { z } from "zod";

/** Client-safe landing page form schema (the Server Action re-validates with it). */
export const landingPageSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/, "lowercase letters, digits, hyphens"),
  title: z.string().trim().min(2).max(160),
  product_id: z.string().uuid().nullable().optional().or(z.literal("")),
  status: z.enum(["draft", "published"]).default("draft"),
  chrome: z.enum(["none", "minimal"]).default("minimal"),
  otp_mode: z.enum(["never", "always", "above_threshold"]).default("above_threshold"),
  otp_threshold_bdt: z.number().int().min(0).max(10_000_000).default(3000),
  pixel_event: z.string().trim().max(60).optional().or(z.literal("")),
  ab_enabled: z.boolean().default(false),
  meta_title: z.string().trim().max(120).optional().or(z.literal("")),
  meta_description: z.string().trim().max(320).optional().or(z.literal("")),
  og_image_url: z.string().trim().max(500).optional().or(z.literal("")),
});
export type LandingPagePayload = z.output<typeof landingPageSchema>;
export type LandingPageInput = z.input<typeof landingPageSchema>;
