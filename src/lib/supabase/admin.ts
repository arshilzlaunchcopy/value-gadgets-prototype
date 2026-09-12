import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * THE ONLY FILE THAT MAY READ SUPABASE_SERVICE_ROLE_KEY (CLAUDE.md rule 2).
 *
 * `server-only` makes any import from a client component a build error.
 * The admin client bypasses RLS. Use it only in Route Handlers, Server Actions
 * and scripts, and only for operations that genuinely need privilege
 * (carts keyed by cookie, OTP codes, seeding, adapters, webhooks).
 */
let instance: SupabaseClient<Database> | null = null;

export function createAdminClient(): SupabaseClient<Database> {
  if (instance) return instance;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Admin client needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }
  instance = createSupabaseClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { "x-application-name": "vgbd-admin" } },
  });
  return instance;
}
