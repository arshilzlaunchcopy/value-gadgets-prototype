import { NextResponse } from "next/server";
import { reconcilePendingPayments } from "@/lib/payments/ipn";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/payment/reconcile - cron: query the gateway for initiated transactions older than 30 min. Bearer CRON_SECRET (or DEMO_SEED_TOKEN). */
export async function POST(req: Request) {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1]?.trim();
  const accepted = [process.env.CRON_SECRET, process.env.DEMO_SEED_TOKEN].filter(Boolean);
  if (!token || !accepted.includes(token)) return NextResponse.json({ ok: false }, { status: 401 });
  const minutes = Number(new URL(req.url).searchParams.get("minutes") ?? 30) || 30;
  const result = await reconcilePendingPayments(minutes);
  return NextResponse.json({ ok: true, ...result });
}
