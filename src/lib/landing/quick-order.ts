import "server-only";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { ensureCustomerForPhone } from "@/lib/auth/identity";
import { availabilityFor } from "@/lib/cart/queries";
import { OrderError, placeOrder, type PlaceOrderResult } from "@/lib/orders/create";
import { isValidBDPhone, toE164BD } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { landingRequiresOtp, type AbVariant, type LandingPagePublic } from "./queries";

/** Three fields, one screen (PART2 §15.2): name, phone, address (+ district for the delivery zone). */
export const quickOrderSchema = z.object({
  landing_slug: z.string().max(120).default(""),
  variant_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(10).default(1),
  name: z.string().trim().min(2, "Enter your name").max(80),
  phone: z.string().trim().refine(isValidBDPhone, "Enter a valid mobile number (01XXXXXXXXX)"),
  district: z.string().trim().min(1, "Select your district"),
  address: z.string().trim().min(5, "Enter your full address").max(300),
  note: z.string().trim().max(300).optional().or(z.literal("")),
  ab_variant: z.enum(["a", "b"]).default("a"),
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
export type QuickOrderInput = z.infer<typeof quickOrderSchema>;

export type QuickOrderOutcome =
  | { ok: true; orderId: string; orderNumber: string; redirectUrl: string; totalBdt: number }
  | { ok: false; needsOtp: true; phone: string; totalBdt: number }
  | { ok: false; needsOtp?: false; error: string; code?: string };

/**
 * Landing-page quick order. Runs the SAME placeOrder path as checkout (fraud
 * score, courier score, stock, snapshots), only the cart is created server-side
 * for this one submission and never touches the visitor's cookie cart.
 */
export async function submitQuickOrder(lp: LandingPagePublic, input: QuickOrderInput, meta: { ip: string | null; userAgent: string | null }, opts: { sessionPhone: string | null; locale?: "en" | "bn" }): Promise<QuickOrderOutcome> {
  const admin = createAdminClient();
  const phone = toE164BD(input.phone)!;

  const { data: variant } = await admin.from("product_variants").select("id, price_bdt, product_id, products(status)").eq("id", input.variant_id).maybeSingle();
  if (!variant || (variant.products as { status: string } | null)?.status !== "active") return { ok: false, error: "This product is not available right now" };
  const available = (await availabilityFor([variant.id], null)).get(variant.id) ?? 0;
  if (available < input.quantity) return { ok: false, error: available === 0 ? "Sorry, this item just sold out" : `Only ${available} left in stock`, code: "OUT_OF_STOCK" };

  const approxTotal = variant.price_bdt * input.quantity;
  const requiresOtp = landingRequiresOtp(lp, approxTotal);
  // the OTP step signs the customer in; the session phone is the only proof of verification
  const verified = opts.sessionPhone === phone;
  if (requiresOtp && !verified) return { ok: false, needsOtp: true, phone, totalBdt: approxTotal };

  const { id: customerId } = await ensureCustomerForPhone(phone);
  const { data: customer } = await admin.from("customers").select("id, phone, full_name, email").eq("id", customerId).single();
  if (!customer) return { ok: false, error: "Could not create your customer profile" };
  if (!customer.full_name) await admin.from("customers").update({ full_name: input.name }).eq("id", customerId);

  // one-shot server-side cart
  const { data: cart, error: cErr } = await admin.from("carts").insert({ session_token: `qo-${randomBytes(24).toString("base64url")}`, customer_id: customerId }).select("id").single();
  if (cErr || !cart) return { ok: false, error: "Could not start the order" };
  await admin.from("cart_items").insert({ cart_id: cart.id, variant_id: variant.id, quantity: input.quantity });

  try {
    const r: PlaceOrderResult = await placeOrder({
      cartId: cart.id,
      customer: { id: customer.id, phone: customer.phone, full_name: customer.full_name ?? input.name, email: customer.email },
      address: { recipient_name: input.name, phone: input.phone, division: "", district: input.district, upazila: "", street_address: input.address },
      paymentMethod: "cod",
      customerNote: input.note || null,
      ip: meta.ip,
      userAgent: meta.userAgent,
      utm: { ...input.utm, landing_page: input.utm?.landing_page ?? `/lp/${lp.slug}` },
      phoneVerified: verified,
      source: "landing",
      landingPageId: lp.id || null,
      abVariant: lp.id ? (input.ab_variant as AbVariant) : null,
      locale: opts.locale ?? "en",
    });
    return { ok: true, orderId: r.orderId, orderNumber: r.orderNumber, redirectUrl: r.redirectUrl ?? `/order/${r.orderNumber}/confirmation`, totalBdt: r.totalBdt };
  } catch (err) {
    if (err instanceof OrderError) return { ok: false, error: err.message, code: err.code };
    console.error("[quick-order] failed:", err);
    return { ok: false, error: "Something went wrong while placing your order. Please try again." };
  } finally {
    await admin.from("carts").delete().eq("id", cart.id);
  }
}
