import { NextResponse } from "next/server";
import { pollOpenShipments } from "@/lib/courier/poll";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/cron/courier-poll - status polling fallback (PART2 §14.4).
 * Bearer CRON_SECRET (or DEMO_SEED_TOKEN in demo mode). Called by the Netlify
 * scheduled function every 30 minutes.
 */
export async function POST(req: Request) {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1]?.trim() ?? "";
  const accepted = [process.env.CRON_SECRET, process.env.DEMO_MODE === "true" ? process.env.DEMO_SEED_TOKEN : undefined].filter(Boolean);
  if (!accepted.length || !accepted.includes(token)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const result = await pollOpenShipments();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
