/**
 * Public (client-safe) environment. Only NEXT_PUBLIC_* vars. Inlined at build time.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === "true",
} as const;
