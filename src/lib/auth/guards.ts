import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";

export type Authz =
  | { ok: true; via: "admin" | "seed-token"; userId: string | null }
  | { ok: false; response: NextResponse };

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

/** Constant-time string compare (both sides are short tokens). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** True when the request carries the DEMO_SEED_TOKEN and demo mode is on. */
export function hasSeedToken(req: Request): boolean {
  const token = process.env.DEMO_SEED_TOKEN;
  if (!isDemoMode() || !token) return false;
  const supplied = bearer(req) ?? req.headers.get("x-demo-token") ?? "";
  return supplied.length > 0 && safeEqual(supplied, token);
}

/** Gate for /api/demo/*: demo mode + seed token, nothing else. */
export function requireSeedToken(req: Request): Authz {
  if (!isDemoMode()) return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (!hasSeedToken(req)) return { ok: false, response: NextResponse.json({ error: "Invalid demo token" }, { status: 401 }) };
  return { ok: true, via: "seed-token", userId: null };
}

/**
 * Gate for admin-only routes (e.g. image upload). Accepts either
 *  - a signed-in user who is an active admin (public.is_admin()), or
 *  - the DEMO_SEED_TOKEN while DEMO_MODE=true (interim, until the Phase 11 admin UI).
 */
export async function requireAdminOrSeedToken(req: Request): Promise<Authz> {
  if (hasSeedToken(req)) return { ok: true, via: "seed-token", userId: null };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error || !isAdmin) return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { ok: true, via: "admin", userId: user.id };
}
