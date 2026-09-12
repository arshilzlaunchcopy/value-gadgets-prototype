import { NextResponse } from "next/server";
import { requireSeedToken } from "@/lib/auth/guards";
import { runCourierTick } from "@/lib/demo/courier-tick";

export const dynamic = "force-dynamic";

/** POST /api/demo/courier/tick - advance due mock shipments. Called by the Netlify scheduled function. */
export async function POST(req: Request) {
  const authz = requireSeedToken(req);
  if (!authz.ok) return authz.response;
  const result = await runCourierTick();
  return NextResponse.json({ ok: true, ...result });
}
