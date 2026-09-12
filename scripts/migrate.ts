/**
 * Migration runner (no Supabase CLI).
 *
 *   npm run db:push                 apply all pending supabase/migrations/*.sql
 *   npm run db:push -- --dry-run    list what would run
 *
 * Each migration runs inside its own transaction and is recorded in
 * public._migrations. Files are applied in filename order.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { connectDb } from "./lib/db";

const MIGRATIONS_DIR = resolve(process.cwd(), "supabase/migrations");
const LOCK_KEY = 8_137_251; // arbitrary advisory-lock id for this runner

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("No migration files found in supabase/migrations/.");
    return;
  }

  const db = await connectDb();
  const started = Date.now();
  try {
    await db.query("select pg_advisory_lock($1)", [LOCK_KEY]);
    await db.query(`
      create table if not exists public._migrations (
        id serial primary key,
        name text not null unique,
        applied_at timestamptz not null default now()
      )
    `);
    const { rows } = await db.query<{ name: string }>(
      "select name from public._migrations order by name",
    );
    const applied = new Set(rows.map((r) => r.name));
    const pending = files.filter((f) => !applied.has(f));

    console.log(
      `Migrations: ${files.length} on disk, ${applied.size} already applied, ${pending.length} pending.`,
    );
    if (pending.length === 0) {
      console.log("Nothing to do.");
      return;
    }
    for (const f of pending) console.log(`  ${dryRun ? "would apply" : "pending"}: ${f}`);
    if (dryRun) return;

    const ran: string[] = [];
    for (const file of pending) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      const t0 = Date.now();
      await db.query("begin");
      try {
        await db.query(sql);
        await db.query("insert into public._migrations (name) values ($1)", [file]);
        await db.query("commit");
        ran.push(file);
        console.log(`  applied ${file} (${Date.now() - t0} ms)`);
      } catch (err) {
        await db.query("rollback");
        const e = err as { message?: string; position?: string; hint?: string; detail?: string };
        console.error(`\nFAILED ${file}: ${e.message ?? String(err)}`);
        if (e.detail) console.error(`  detail: ${e.detail}`);
        if (e.hint) console.error(`  hint: ${e.hint}`);
        if (e.position) console.error(`  at character ${e.position}`);
        console.error(
          `\nRolled back. ${ran.length} migration(s) applied before the failure: ${ran.join(", ") || "none"}.`,
        );
        process.exitCode = 1;
        return;
      }
    }
    console.log(`\nDone: applied ${ran.length} migration(s) in ${Date.now() - started} ms.`);
  } finally {
    await db.query("select pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
