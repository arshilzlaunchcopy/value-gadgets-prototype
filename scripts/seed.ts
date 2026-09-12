/**
 * Seed CLI (idempotent, fixed random seed).
 *   npm run seed                  full seed (catalog, customers, 320 orders, reviews)
 *   npm run seed -- --catalog     catalog only
 *   npm run seed -- --reset       wipe transactional tables, then full seed
 *   npm run seed -- --reset-all   wipe everything (incl. seeded auth users), then full seed
 *   npm run seed -- --orders 20   add 20 fresh orders
 *
 * Runs with `tsx --conditions=react-server` so server-only modules load.
 */
import { loadEnv } from "./lib/env";

loadEnv();
if (process.env.DEMO_MODE !== "true") {
  console.error("Refusing to seed: DEMO_MODE is not 'true' in .env.local");
  process.exit(1);
}

(async () => {
  const seed = await import("../src/lib/seed");
  const args = process.argv.slice(2);
  const t0 = Date.now();
  let out: unknown;
  if (args.includes("--catalog")) out = { settings: await seed.seedSettings(), products: (await seed.seedCatalog()).products.size };
  else if (args.includes("--settings")) out = { settings: await seed.seedSettings() };
  else if (args.includes("--reset-all")) out = await seed.resetAll();
  else if (args.includes("--reset")) out = await seed.resetTransactional();
  else if (args.includes("--orders")) out = await seed.generateOrders(Number(args[args.indexOf("--orders") + 1] ?? 20));
  else out = await seed.seedAll();
  console.log(JSON.stringify(out), `(${Date.now() - t0} ms)`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
