import { z } from "zod";

/** Coupon editor payload (client-safe; the Server Action re-validates). Money is integer BDT. */
export const couponSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(3).max(32).regex(/^[A-Z0-9-]+$/i, "letters, digits, hyphens").transform((s) => s.toUpperCase()),
  description: z.string().trim().max(200).optional().or(z.literal("")),
  type: z.enum(["percentage", "fixed", "free_shipping"]),
  value: z.number().int().min(0).max(1_000_000),
  min_order_bdt: z.number().int().min(0).default(0),
  max_discount_bdt: z.number().int().min(0).nullable().optional(),
  usage_limit: z.number().int().min(1).nullable().optional(),
  usage_limit_per_customer: z.number().int().min(0).default(1),
  applies_all: z.boolean().default(true),
  category_ids: z.array(z.string().uuid()).default([]),
  product_ids: z.array(z.string().uuid()).default([]),
  starts_at: z.string().optional().or(z.literal("")),
  ends_at: z.string().optional().or(z.literal("")),
  is_active: z.boolean().default(true),
});
export type CouponPayload = z.output<typeof couponSchema>;
export type CouponInput = z.input<typeof couponSchema>;
