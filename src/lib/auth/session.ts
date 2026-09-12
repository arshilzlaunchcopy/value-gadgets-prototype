import "server-only";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export interface CurrentCustomer {
  id: string;
  phone: string;
  full_name: string | null;
  email: string | null;
}

/** The signed-in customer (cookie session), or null. Reads customers through RLS as that user. */
export async function getCurrentCustomer(): Promise<CurrentCustomer | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("customers").select("id, phone, full_name, email").eq("id", user.id).maybeSingle();
  return data ?? null;
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

/** Best-effort client IP + UA for rate limiting and fraud signals. */
export async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for") ?? h.get("x-nf-client-connection-ip") ?? h.get("x-real-ip");
  const ip = fwd ? fwd.split(",")[0].trim() : null;
  return { ip: ip && /^[\d.a-f:]+$/i.test(ip) ? ip : null, userAgent: h.get("user-agent") };
}
