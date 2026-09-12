"use server";

import { z } from "zod";
import { isValidBDPhone, toE164BD } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  email: z.string().trim().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  source: z.string().max(200).optional().or(z.literal("")),
  locale: z.enum(["en", "bn"]).default("en"),
});

/** newsletter_signup block target. Service-role insert; the table is admin-only under RLS. */
export async function subscribeNewsletterAction(raw: unknown): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const p = schema.safeParse(raw);
  if (!p.success) return { ok: false, error: "Please check the form" };
  const email = p.data.email?.toLowerCase() || null;
  const phone = p.data.phone ? toE164BD(p.data.phone) : null;
  if (p.data.phone && !isValidBDPhone(p.data.phone)) return { ok: false, error: "Enter a valid Bangladeshi mobile number" };
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Enter a valid email" };
  if (!email && !phone) return { ok: false, error: "Enter an email or a phone number" };
  const admin = createAdminClient();
  const row = { email, phone, source: p.data.source || null, locale: p.data.locale, unsubscribed_at: null };
  const { error } = email ? await admin.from("newsletter_subscribers").upsert(row, { onConflict: "email" }) : await admin.from("newsletter_subscribers").upsert(row, { onConflict: "phone" });
  if (error) {
    if (error.code === "23505") return { ok: true, message: p.data.locale === "bn" ? "আপনি ইতিমধ্যে সাবস্ক্রাইব করেছেন।" : "You are already subscribed." };
    return { ok: false, error: "Could not subscribe right now" };
  }
  return { ok: true, message: p.data.locale === "bn" ? "ধন্যবাদ! অফার আসলে জানিয়ে দেব।" : "Thanks! We will message you when a deal drops." };
}
