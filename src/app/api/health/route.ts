import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/health - trivial DB round trip through the anon client (RLS applies).
 * Pinged by .github/workflows/keepalive.yml so the Supabase free tier does not
 * pause after 7 idle days.
 */
export async function GET() {
  const started = Date.now();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("bd_locations").select("id").limit(1);
    if (error) throw error;
    return NextResponse.json(
      {
        ok: true,
        db: "up",
        rows: data?.length ?? 0,
        latency_ms: Date.now() - started,
        time: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, db: "down", error: message, latency_ms: Date.now() - started },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
