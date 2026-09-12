/**
 * Create a timestamped migration file.
 *   npm run db:new add_coupons   ->  supabase/migrations/20260912053000_add_coupons.sql
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const name = process.argv.slice(2).join("_").trim();
if (!name) {
  console.error("Usage: npm run db:new <name>   (letters, digits, underscores)");
  process.exit(1);
}
if (!/^[a-z0-9_]+$/i.test(name)) {
  console.error(`Invalid migration name "${name}". Use letters, digits and underscores only.`);
  process.exit(1);
}

const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14); // YYYYMMDDHHMMSS UTC
const dir = resolve(process.cwd(), "supabase/migrations");
mkdirSync(dir, { recursive: true });
const fileName = `${ts}_${name.toLowerCase()}.sql`;
const file = join(dir, fileName);
if (existsSync(file)) {
  console.error(`Already exists: ${file}`);
  process.exit(1);
}
writeFileSync(
  file,
  `-- ${fileName}\n-- Every table: RLS enabled + explicit policies + updated_at trigger.\n\n`,
);
console.log(`Created supabase/migrations/${fileName}`);
