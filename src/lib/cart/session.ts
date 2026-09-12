import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cart identity = httpOnly cookie holding carts.session_token (CLAUDE.md rule 7).
 * Carts are service-role-only; the browser never sees a cart id it could tamper with.
 */
export const CART_COOKIE = "vgbd_cart";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function readCartToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value ?? null;
}

/** Cart id for the current visitor, or null when they have no live cart. Read-only (safe in Server Components). */
export async function getCartId(): Promise<string | null> {
  const token = await readCartToken();
  if (!token) return null;
  const { data } = await createAdminClient().from("carts").select("id, expires_at").eq("session_token", token).maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data.id;
}

/** Get or create the visitor's cart. Only call from Server Actions / Route Handlers (cookie writes). */
export async function getOrCreateCartId(): Promise<string> {
  const existing = await getCartId();
  if (existing) return existing;
  const admin = createAdminClient();
  const token = randomBytes(32).toString("base64url");
  const { data, error } = await admin.from("carts").insert({ session_token: token }).select("id").single();
  if (error) throw new Error(`cart create failed: ${error.message}`);
  const store = await cookies();
  store.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
  return data.id;
}

export async function clearCartCookie(): Promise<void> {
  const store = await cookies();
  store.delete(CART_COOKIE);
}
