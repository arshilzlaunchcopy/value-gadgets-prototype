import "server-only";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Display-only gateway return handlers (BUILD_PROMPT §9.5). They look the
 * order up by tran_id and redirect to the confirmation page. They NEVER
 * write payment state; the confirmation page reads it from the database.
 */
export async function gatewayReturn(req: Request, outcome: "success" | "failed" | "cancelled"): Promise<NextResponse> {
  const url = new URL(req.url);
  let tranId = url.searchParams.get("tran_id");
  if (!tranId && req.method === "POST") {
    try {
      const form = await req.formData();
      tranId = String(form.get("tran_id") ?? "");
    } catch {
      /* no body */
    }
  }
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;
  if (!tranId) return NextResponse.redirect(new URL(`/cart?payment=${outcome}`, base), 303);

  const { data: txn } = await createAdminClient().from("payment_transactions").select("orders(order_number)").eq("gateway_txn_id", tranId).maybeSingle();
  const number = (txn?.orders as { order_number: string } | null)?.order_number;
  if (!number) return NextResponse.redirect(new URL(`/cart?payment=${outcome}`, base), 303);
  return NextResponse.redirect(new URL(`/order/${number}/confirmation?payment=${outcome}`, base), 303);
}
