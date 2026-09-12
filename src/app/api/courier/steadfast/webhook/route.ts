import { NextResponse } from "next/server";
import { courierWebhookSchema, processCourierWebhook } from "@/lib/courier/webhook";
import { isDemoMode } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * POST /api/courier/steadfast/webhook - courier status push (PART2 §14.4).
 * Bearer token from STEADFAST_WEBHOOK_TOKEN (in production this lives in settings).
 * In demo mode the DEMO_SEED_TOKEN is also accepted so the panel can replay events.
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(.+)$/i.exec(auth)?.[1]?.trim() ?? "";
  const accepted = [process.env.STEADFAST_WEBHOOK_TOKEN, isDemoMode() ? process.env.DEMO_SEED_TOKEN : undefined].filter(Boolean);
  if (accepted.length === 0 || !accepted.includes(token)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const parsed = courierWebhookSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const result = await processCourierWebhook(parsed.data, "webhook");
  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}
