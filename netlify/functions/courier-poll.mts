import type { Config } from "@netlify/functions";

/** Every 30 minutes: poll the courier for open shipments whose webhook may have been missed (PART2 §14.4). */
const courierPoll = async () => {
  const base = process.env.URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  const token = process.env.CRON_SECRET ?? process.env.DEMO_SEED_TOKEN;
  if (!base || !token) return new Response("missing URL or CRON_SECRET", { status: 200 });
  const res = await fetch(`${base}/api/cron/courier-poll`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  return new Response(await res.text(), { status: res.status });
};

export default courierPoll;

export const config: Config = { schedule: "*/30 * * * *" };
