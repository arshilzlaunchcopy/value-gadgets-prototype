import type { Config } from "@netlify/functions";

/** Every 30 minutes: reconcile initiated payments whose IPN never arrived (BUILD_PROMPT §9). */
const reconcilePayments = async () => {
  const base = process.env.URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  const token = process.env.CRON_SECRET ?? process.env.DEMO_SEED_TOKEN;
  if (!base || !token) return new Response("missing URL or CRON_SECRET", { status: 200 });
  const res = await fetch(`${base}/api/payment/reconcile`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  return new Response(await res.text(), { status: res.status });
};

export default reconcilePayments;

export const config: Config = { schedule: "*/30 * * * *" };
