"use server";

import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/env";
import { getMockPayment } from "@/lib/integrations/payment";
import { processIpn } from "@/lib/payments/ipn";

/**
 * The fake gateway's "bank side". Records the outcome, then POSTs an
 * SSLCommerz-shaped IPN to the real /api/payment/ipn over HTTP - exactly what
 * SSLCommerz does - and finally redirects the shopper like the gateway would.
 */
export async function completeGateway(formData: FormData): Promise<void> {
  if (!isDemoMode()) redirect("/");
  const txn = String(formData.get("txn") ?? "");
  const outcome = String(formData.get("outcome") ?? "cancelled") as "success" | "failed" | "cancelled";
  const method = String(formData.get("method") ?? "card") as "card" | "bkash" | "nagad";
  if (!txn) redirect("/demo/gateway/result?status=error");

  const mock = getMockPayment();
  const { payload, orderNumber } = await mock.recordOutcome(txn, outcome, method);

  let result = "error";
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const res = await fetch(new URL("/api/payment/ipn", base), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(payload).toString(),
      cache: "no-store",
    });
    const json = (await res.json()) as { result?: string };
    result = json.result ?? "error";
  } catch (err) {
    // No HTTP path (e.g. SITE_URL not reachable from the server): run the same handler in-process.
    console.warn("[demo gateway] IPN over HTTP failed, calling handler directly:", err instanceof Error ? err.message : err);
    const out = await processIpn(payload);
    result = out.result;
  }

  const q = new URLSearchParams({ status: result, order: orderNumber ?? "", txn });
  redirect(`/demo/gateway/result?${q.toString()}`);
}
