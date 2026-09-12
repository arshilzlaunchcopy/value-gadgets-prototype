import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** POST /api/cron/release-reservations - drop expired 30-minute stock holds. Bearer CRON_SECRET (or DEMO_SEED_TOKEN). */
export async function POST(req: Request) {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1]?.trim();
  const accepted = [process.env.CRON_SECRET, process.env.DEMO_SEED_TOKEN].filter(Boolean);
  if (!token || !accepted.includes(token)) return NextResponse.json({ ok: false }, { status: 401 });
  const { data, error } = await createAdminClient().rpc("release_expired_reservations");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, released: data });
}
