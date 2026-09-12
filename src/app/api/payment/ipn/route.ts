import { NextResponse } from "next/server";
import { processIpn } from "@/lib/payments/ipn";

export const dynamic = "force-dynamic";

/**
 * POST /api/payment/ipn - SSLCommerz IPN (also hit by the demo gateway with an
 * identical payload). Accepts form-encoded or JSON. Always answers quickly;
 * validation is performed server-to-server inside processIpn.
 */
export async function POST(req: Request) {
  const ct = req.headers.get("content-type") ?? "";
  let body: Record<string, unknown>;
  try {
    if (ct.includes("application/json")) body = (await req.json()) as Record<string, unknown>;
    else body = Object.fromEntries((await req.formData()).entries()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "unreadable body" }, { status: 400 });
  }

  const outcome = await processIpn(body);
  return NextResponse.json({ ok: outcome.code === 200, ...outcome }, { status: outcome.code });
}
