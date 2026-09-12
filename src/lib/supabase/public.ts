import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env.public";

/**
 * Cookie-less anon client for cached, public storefront reads (ISR pages).
 * A cookies()-bound client would force dynamic rendering; this one sees
 * exactly what an anonymous visitor sees through RLS.
 */
let instance: SupabaseClient<Database> | null = null;

export function createPublicClient(): SupabaseClient<Database> {
  if (instance) return instance;
  instance = createSupabaseClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "x-application-name": "vgbd-public" } },
  });
  return instance;
}
