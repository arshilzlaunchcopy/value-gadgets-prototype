import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

for (const f of [".env.test.local", ".env.local"]) {
  const p = resolve(process.cwd(), f);
  if (existsSync(p)) config({ path: p, override: false, quiet: true });
}

if (process.env.DEMO_MODE !== "true") {
  throw new Error("Tests require DEMO_MODE=true (they exercise the mock gateway against the demo database)");
}
