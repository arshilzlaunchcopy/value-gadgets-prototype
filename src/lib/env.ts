import "server-only";
import { z } from "zod";

/**
 * Server-side environment. Validated once, lazily, so `next build` does not
 * fail on machines that only have the public vars set.
 *
 * SUPABASE_SERVICE_ROLE_KEY is deliberately NOT read here. It is read only by
 * src/lib/supabase/admin.ts (CLAUDE.md rule 2).
 */
const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  DEMO_MODE: z.enum(["true", "false"]).default("false"),
  DEMO_SEED_TOKEN: z.string().optional(),
  AUTH_PEPPER: z.string().optional(),
  PHONE_EMAIL_DOMAIN: z.string().default("phone.vgbd.local"),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_BASE_URL: z.string().optional(),
  SSLCZ_STORE_ID: z.string().optional(),
  SSLCZ_STORE_PASSWD: z.string().optional(),
  STEADFAST_API_KEY: z.string().optional(),
  STEADFAST_SECRET_KEY: z.string().optional(),
  STEADFAST_WEBHOOK_TOKEN: z.string().optional(),
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER_ID: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid server environment: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

/** Throws with a clear message when a required var is blank. Used by real adapters. */
export function requireEnv(name: keyof ServerEnv | string): string {
  const v = process.env[name as string];
  if (!v || v.trim() === "") {
    throw new Error(`Missing required environment variable ${String(name)}`);
  }
  return v;
}
