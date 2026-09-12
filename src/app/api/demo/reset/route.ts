import { NextResponse } from "next/server";
import { requireSeedToken } from "@/lib/auth/guards";
import { resetTransactional } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST /api/demo/reset - truncate transactional tables and re-seed them. Keeps catalog + content. */
export async function POST(req: Request) {
  const authz = requireSeedToken(req);
  if (!authz.ok) return authz.response;
  try {
    const summary = await resetTransactional();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
