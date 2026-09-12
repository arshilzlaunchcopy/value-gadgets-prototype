"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { requestOtp, verifyOtp } from "@/lib/auth/otp";
import { getCurrentCustomer, requestMeta } from "@/lib/auth/session";
import { verifyTurnstile } from "@/lib/auth/turnstile";
import { getCartId } from "@/lib/cart/session";
import { computeTotals } from "@/lib/cart/totals";
import type { Totals } from "@/lib/cart/types";
import { LAST_ORDER_COOKIE, placeOrderSchema } from "@/lib/checkout/schema";
import { LOCALE_COOKIE } from "@/lib/i18n/messages";
import { OrderError, placeOrder } from "@/lib/orders/create";
import { getPayment } from "@/lib/integrations/payment";
import { isValidBDPhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";

// ------------------------------------------------------------------- OTP

export async function sendOtpAction(phoneRaw: string, turnstileToken?: string | null) {
  const phone = z.string().trim().min(10).max(20).safeParse(phoneRaw);
  if (!phone.success || !isValidBDPhone(phone.data)) return { ok: false as const, error: "Enter a valid Bangladeshi mobile number (01XXXXXXXXX)" };
  const [meta, jar] = await Promise.all([requestMeta(), cookies()]);
  if (!(await verifyTurnstile(turnstileToken, meta.ip))) return { ok: false as const, error: "Please complete the verification challenge" };
  return requestOtp({ phone: phone.data, ip: meta.ip, userAgent: meta.userAgent, locale: jar.get(LOCALE_COOKIE)?.value === "bn" ? "bn" : "en" });
}

export async function verifyOtpAction(phoneRaw: string, codeRaw: string) {
  const phone = z.string().trim().safeParse(phoneRaw);
  const code = z.string().trim().regex(/^\d{6}$/).safeParse(codeRaw);
  if (!phone.success || !code.success) return { ok: false as const, error: "Enter the 6-digit code" };
  const [cartId, jar] = await Promise.all([getCartId(), cookies()]);
  const r = await verifyOtp({ phone: phone.data, code: code.data, cartId, locale: jar.get(LOCALE_COOKIE)?.value === "bn" ? "bn" : "en" });
  if (!r.ok) return r;
  const customer = await getCurrentCustomer();
  const addresses = customer ? await savedAddresses(customer.id) : [];
  return { ok: true as const, customer, addresses, isNew: r.isNew };
}

export interface SavedAddress {
  id: string;
  recipient_name: string | null;
  phone: string | null;
  division: string | null;
  district: string | null;
  upazila: string | null;
  area: string | null;
  street_address: string;
  postcode: string | null;
  landmark: string | null;
  is_default: boolean;
}

export async function savedAddresses(customerId: string): Promise<SavedAddress[]> {
  const { data } = await createAdminClient()
    .from("addresses")
    .select("id, recipient_name, phone, division, district, upazila, area, street_address, postcode, landmark, is_default")
    .eq("customer_id", customerId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5);
  return (data ?? []) as SavedAddress[];
}

// ---------------------------------------------------------------- totals

export async function quoteTotalsAction(district: string | null, couponCode: string | null): Promise<Totals> {
  const [cartId, customer] = await Promise.all([getCartId(), getCurrentCustomer()]);
  return computeTotals(cartId, { district, couponCode, customerId: customer?.id ?? null });
}

// ------------------------------------------------------------ place order

export type PlaceOrderActionResult =
  | { ok: true; orderNumber: string; redirectUrl: string }
  | { ok: false; error: string; code?: string; details?: unknown; fieldErrors?: Record<string, string[] | undefined> };

export async function placeOrderAction(payloadRaw: unknown): Promise<PlaceOrderActionResult> {
  const parsed = placeOrderSchema.safeParse(payloadRaw);
  if (!parsed.success) return { ok: false, error: "Please check the highlighted fields", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[] | undefined> };
  const [cartId, customer, meta, jar] = await Promise.all([getCartId(), getCurrentCustomer(), requestMeta(), cookies()]);
  if (!customer) return { ok: false, error: "Please verify your phone number first", code: "UNAUTHENTICATED" };
  if (!cartId) return { ok: false, error: "Your cart is empty", code: "EMPTY_CART" };

  try {
    const r = await placeOrder({
      cartId,
      customer,
      address: parsed.data.address,
      paymentMethod: parsed.data.paymentMethod,
      couponCode: parsed.data.couponCode ?? null,
      customerNote: parsed.data.customerNote ?? null,
      ip: meta.ip,
      userAgent: meta.userAgent,
      utm: parsed.data.utm,
      locale: jar.get(LOCALE_COOKIE)?.value === "bn" ? "bn" : "en",
    });
    const store = await cookies();
    store.set(LAST_ORDER_COOKIE, r.orderId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 });
    return { ok: true, orderNumber: r.orderNumber, redirectUrl: r.redirectUrl ?? `/order/${r.orderNumber}/confirmation` };
  } catch (err) {
    if (err instanceof OrderError) return { ok: false, error: err.message, code: err.code, details: err.details };
    console.error("[checkout] placeOrder failed:", err);
    return { ok: false, error: "Something went wrong while placing your order. Please try again." };
  }
}

/** Retry an online payment for a pending order the customer owns. */
export async function retryPaymentAction(orderNumber: string): Promise<{ ok: boolean; redirectUrl?: string; error?: string }> {
  const customer = await getCurrentCustomer();
  const store = await cookies();
  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("*").eq("order_number", orderNumber).maybeSingle();
  if (!order) return { ok: false, error: "Order not found" };
  const owns = (customer && order.customer_id === customer.id) || store.get(LAST_ORDER_COOKIE)?.value === order.id;
  if (!owns) return { ok: false, error: "Not allowed" };
  if (order.payment_method !== "sslcommerz" || order.payment_status === "paid" || order.status !== "pending_payment") return { ok: false, error: "This order cannot be paid online" };
  const session = await getPayment().createSession(order);
  return { ok: true, redirectUrl: session.redirectUrl };
}
