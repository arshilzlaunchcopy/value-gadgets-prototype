import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env.public";

/**
 * Server client for Server Components, Route Handlers and Server Actions.
 * Uses the anon key + the request's auth cookies, so RLS applies as the
 * signed-in user (or anon). Never use this for privileged writes; use admin.ts.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there.
          // Session refresh is handled by middleware / route handlers.
        }
      },
    },
  });
}
