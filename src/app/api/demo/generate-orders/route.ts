import { NextResponse } from "next/server";
import { requireSeedToken } from "@/lib/auth/guards";
import { generateOrders } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/demo/generate-orders?n=20 - add fresh orders on demand. */
export async function POST(req: Request) {
  const authz = requireSeedToken(req);
  if (!authz.ok) return authz.response;
  const n = Math.max(1, Math.min(200, Number(new URL(req.url).searchParams.get("n") ?? 20) || 20));
  try {
    const result = await generateOrders(n);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
