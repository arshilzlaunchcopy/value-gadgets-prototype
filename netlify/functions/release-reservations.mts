import type { Config } from "@netlify/functions";

/** Every 10 minutes: release expired stock reservations (PART2 §15.6). */
const releaseReservations = async () => {
  const base = process.env.URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  const token = process.env.CRON_SECRET ?? process.env.DEMO_SEED_TOKEN;
  if (!base || !token) return new Response("missing URL or CRON_SECRET", { status: 200 });
  const res = await fetch(`${base}/api/cron/release-reservations`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  return new Response(await res.text(), { status: res.status });
};

export default releaseReservations;

export const config: Config = { schedule: "*/10 * * * *" };
