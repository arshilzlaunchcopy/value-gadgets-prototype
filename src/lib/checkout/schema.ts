import { z } from "zod";
import { isValidBDPhone } from "@/lib/phone";

/** Client-safe checkout schemas (shared by React Hook Form and the Server Action). */
export const addressSchema = z.object({
  recipient_name: z.string().trim().min(2, "Enter the recipient's name").max(80),
  phone: z.string().trim().refine(isValidBDPhone, "Enter a valid mobile number"),
  division: z.string().trim().min(1, "Select a division"),
  district: z.string().trim().min(1, "Select a district"),
  upazila: z.string().trim().min(1, "Select or enter the upazila / area"),
  area: z.string().trim().max(80).optional().or(z.literal("")),
  street_address: z.string().trim().min(5, "Enter the street address").max(200),
  postcode: z.string().trim().max(10).optional().or(z.literal("")),
  landmark: z.string().trim().max(120).optional().or(z.literal("")),
});
export type AddressValues = z.infer<typeof addressSchema>;

export const placeOrderSchema = z.object({
  address: addressSchema,
  paymentMethod: z.enum(["cod", "sslcommerz"]),
  couponCode: z.string().trim().max(32).nullable().optional(),
  customerNote: z.string().trim().max(300).nullable().optional(),
  acceptTerms: z.literal(true, { message: "You must accept the terms to continue" }),
  utm: z
    .object({
      source: z.string().max(60).nullable().optional(),
      medium: z.string().max(60).nullable().optional(),
      campaign: z.string().max(80).nullable().optional(),
      landing_page: z.string().max(200).nullable().optional(),
      referrer: z.string().max(300).nullable().optional(),
    })
    .optional(),
});
export type PlaceOrderPayload = z.infer<typeof placeOrderSchema>;

/** httpOnly cookie set at placement so a guest can open their confirmation page. */
export const LAST_ORDER_COOKIE = "vgbd_last_order";
