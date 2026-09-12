"use server";

import { z } from "zod";
import { getCurrentCustomer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/** Customer updates their own row through RLS (customers: self update). */
export async function updateProfileAction(field: "full_name" | "email", valueRaw: string): Promise<{ ok: boolean; error?: string }> {
  const customer = await getCurrentCustomer();
  if (!customer) return { ok: false, error: "Not signed in" };
  const schema = field === "email" ? z.string().trim().email("Enter a valid email").max(120) : z.string().trim().min(2, "Enter your name").max(80);
  const v = schema.safeParse(valueRaw);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message };
  const supabase = await createClient();
  const patch = field === "email" ? { email: v.data } : { full_name: v.data };
  const { error } = await supabase.from("customers").update(patch).eq("id", customer.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
