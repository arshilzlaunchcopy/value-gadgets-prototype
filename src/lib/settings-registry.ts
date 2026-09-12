import { z } from "zod";
import { deliverySettingsSchema, storeSettingsSchema } from "@/lib/settings";

/**
 * Every editable settings key (BUILD_PROMPT §6.2 Settings) with its schema and
 * visibility. Admin forms are derived from these schemas with schemaToFields(),
 * the same way block forms are, so adding a setting is adding a field here.
 */
const localized = z.object({ en: z.string().max(320), bn: z.string().max(320).optional().or(z.literal("")) });

export const smsTemplatesSchema = z.object({
  otp: localized.describe("{store} {code} {minutes}"),
  order_confirmed: localized.describe("{order_number} {total} {url}"),
  shipped: localized.describe("{order_number} {courier} {tracking_id}"),
  delivered: localized.describe("{order_number} {url}"),
  abandoned_cart: localized.describe("{store} {url}"),
  advance_payment: localized.describe("{order_number} {amount} {url}"),
});

const emailTemplate = z.object({ subject_en: z.string().max(160), body_en: z.string().max(4000).describe("Markdown"), subject_bn: z.string().max(160).optional().or(z.literal("")), body_bn: z.string().max(4000).optional().or(z.literal("")).describe("Markdown (Bangla)") });
export const emailTemplatesSchema = z.object({
  order_confirmed: emailTemplate,
  shipped: emailTemplate,
  delivered: emailTemplate,
});

export const paymentsSettingsSchema = z.object({
  sslcz_store_id: z.string().max(80).optional().or(z.literal("")).describe("Overrides SSLCZ_STORE_ID when set"),
  sslcz_store_passwd: z.string().max(120).optional().or(z.literal("")).describe("Stored server-side only"),
  sslcz_sandbox: z.boolean().default(true),
  bkash_merchant_number: z.string().max(20).optional().or(z.literal("")).describe("Shown on advance-payment SMS"),
  cod_advance_bdt: z.number().int().min(0).default(100).describe("Advance for risky COD orders (PART2 §15.1)"),
});

export const localeSettingsSchema = z.object({
  default_locale: z.enum(["en", "bn"]).default("en"),
  show_language_switcher: z.boolean().default(true),
  bangla_numerals: z.boolean().default(false).describe("Show prices as ৳১,২৫০ when the site is in Bangla"),
});

export const otpSettingsSchema = z.object({
  ttl_min: z.number().int().min(1).max(30).default(5),
  per_phone_hour: z.number().int().min(1).max(20).default(3),
  per_ip_hour: z.number().int().min(1).max(100).default(10),
  cooldown_s: z.number().int().min(10).max(600).default(60),
  max_failed: z.number().int().min(1).max(20).default(5),
});

export const SETTINGS_REGISTRY = {
  store: { label: "Store info", schema: storeSettingsSchema, is_public: true, description: "Name, tagline, contact, trade licence (footer, invoices, SSLCommerz)." },
  delivery: { label: "Delivery policy", schema: deliverySettingsSchema, is_public: true, description: "Return window and COD availability. Zones and rates are edited below." },
  locale: { label: "Language", schema: localeSettingsSchema, is_public: true, description: "Default language, switcher, Bangla numerals." },
  sms_templates: { label: "SMS templates", schema: smsTemplatesSchema, is_public: false, description: "English and Bangla per event. Placeholders in braces." },
  email_templates: { label: "Email templates", schema: emailTemplatesSchema, is_public: false, description: "Subject and markdown body per event." },
  payments: { label: "Payment gateway", schema: paymentsSettingsSchema, is_public: false, description: "Credentials override environment variables. Kept server-side." },
  otp: { label: "OTP limits", schema: otpSettingsSchema, is_public: false, description: "Rate limits for phone verification (BUILD_PROMPT §8)." },
} as const;

export type SettingsKey = keyof typeof SETTINGS_REGISTRY;
export const SETTINGS_KEYS = Object.keys(SETTINGS_REGISTRY) as SettingsKey[];
