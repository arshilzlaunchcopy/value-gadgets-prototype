import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/** Load .env.local (then .env) from the repo root. Safe to call more than once. */
export function loadEnv(): void {
  for (const file of [".env.local", ".env"]) {
    const p = resolve(process.cwd(), file);
    if (existsSync(p)) config({ path: p, override: false, quiet: true });
  }
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    console.error(`Missing required env var ${name} (check .env.local)`);
    process.exit(1);
  }
  return v;
}
