import type { Config } from "@netlify/functions";

/**
 * Netlify scheduled function: every 2 minutes, ask the app to advance mock
 * shipments (BUILD_PROMPT_PART3 §20.3). No-op unless DEMO_MODE=true.
 */
const courierTick = async () => {
  if (process.env.DEMO_MODE !== "true") return new Response("demo mode off", { status: 200 });
  const base = process.env.URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  const token = process.env.DEMO_SEED_TOKEN;
  if (!base || !token) return new Response("missing URL or DEMO_SEED_TOKEN", { status: 200 });
  const res = await fetch(`${base}/api/demo/courier/tick`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return new Response(await res.text(), { status: res.status });
};

export default courierTick;

export const config: Config = { schedule: "*/2 * * * *" };
