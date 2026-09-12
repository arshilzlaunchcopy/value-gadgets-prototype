"use server";

import { cookies } from "next/headers";
import { getCurrentCustomer, requestMeta } from "@/lib/auth/session";
import { LAST_ORDER_COOKIE } from "@/lib/checkout/schema";
import { getLandingPage } from "@/lib/landing/queries";
import { quickOrderSchema, submitQuickOrder, type QuickOrderOutcome } from "@/lib/landing/quick-order";

/** quick_order_form submit. The landing page decides whether OTP is needed (PART2 §15.2). */
export async function quickOrderAction(raw: unknown): Promise<QuickOrderOutcome> {
  const parsed = quickOrderSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form" };
  const lp = parsed.data.landing_slug ? await getLandingPage(parsed.data.landing_slug) : null;
  // A quick_order_form outside a landing page (product/custom page) always asks for OTP.
  const page = lp ?? { id: "", slug: "", title: "", product_id: null, chrome: "minimal" as const, otp_mode: "always" as const, otp_threshold_bdt: 0, pixel_event: null, ab_enabled: false, variant_b_id: "", meta_title: null, meta_description: null, og_image_url: null, updated_at: "" };
  const [meta, current] = await Promise.all([requestMeta(), getCurrentCustomer()]);
  const r = await submitQuickOrder({ ...page, id: lp?.id ?? "" }, parsed.data, meta, { sessionPhone: current?.phone ?? null });
  if (r.ok) {
    const store = await cookies();
    store.set(LAST_ORDER_COOKIE, r.orderId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 });
  }
  return r;
}
