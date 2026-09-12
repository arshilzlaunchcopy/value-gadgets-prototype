import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type SmsTemplateKind = "otp" | "order_confirmed" | "shipped" | "delivered";

const FALLBACK: Record<SmsTemplateKind, string> = {
  otp: "Your {store} verification code is {code}. Valid for {minutes} minutes.",
  order_confirmed: "Order {order_number} confirmed. Total Tk {total}. Track: {url}",
  shipped: "Order {order_number} shipped via {courier}. Tracking: {tracking_id}",
  delivered: "Order {order_number} delivered. Thank you! Review: {url}",
};

/** Render an SMS from the settings-stored templates (en/bn) with {placeholders}. */
export async function renderSms(kind: SmsTemplateKind, vars: Record<string, string>, locale: "en" | "bn" = "en"): Promise<string> {
  const admin = createAdminClient();
  const [{ data: tpl }, { data: store }] = await Promise.all([
    admin.from("settings").select("value").eq("key", "sms_templates").maybeSingle(),
    admin.from("settings").select("value").eq("key", "store").maybeSingle(),
  ]);
  const templates = (tpl?.value ?? {}) as Record<string, { en?: string; bn?: string }>;
  const text = templates[kind]?.[locale] ?? templates[kind]?.en ?? FALLBACK[kind];
  const storeName = ((store?.value as { name?: string } | null)?.name ?? "Store").trim();
  const all: Record<string, string> = { store: storeName, ...vars };
  return text.replace(/\{(\w+)\}/g, (_, k: string) => all[k] ?? `{${k}}`);
}
