import "server-only";

import { z } from "zod";
import { getPayment } from "@/lib/integrations/payment";
import { notifyConfirmed } from "@/lib/orders/create";
import { appendOrderEvent, transitionOrder } from "@/lib/orders/status";
import { createAdminClient } from "@/lib/supabase/admin";

/** SSLCommerz IPN fields we rely on. Everything else is stored raw. */
export const ipnSchema = z.object({
  tran_id: z.string().min(1),
  val_id: z.string().optional().default(""),
  amount: z.string().or(z.number()).transform((v) => Number(v)),
  currency: z.string().default("BDT"),
  status: z.string(),
  bank_tran_id: z.string().optional(),
  card_type: z.string().optional(),
  card_issuer: z.string().optional(),
});

export type IpnOutcome =
  | { code: 200; result: "already_processed" | "paid" | "failed" | "cancelled" }
  | { code: 202; result: "rejected"; reason: string }
  | { code: 404; result: "unknown_transaction" };

/**
 * The real IPN logic (BUILD_PROMPT §9). Never trusts the browser or the IPN body:
 * the order is marked paid ONLY when the gateway's validation API says VALID,
 * the validated amount equals orders.total_bdt, and the currency is BDT.
 * Idempotent on gateway_txn_id.
 */
export async function processIpn(raw: Record<string, unknown>): Promise<IpnOutcome> {
  const admin = createAdminClient();
  const parsed = ipnSchema.safeParse(raw);
  if (!parsed.success) return { code: 202, result: "rejected", reason: "malformed payload" };
  const ipn = parsed.data;

  const { data: txn } = await admin
    .from("payment_transactions")
    .select("id, order_id, status, amount_bdt, gateway, orders(id, status, payment_status, total_bdt)")
    .eq("gateway_txn_id", ipn.tran_id)
    .maybeSingle();
  if (!txn) return { code: 404, result: "unknown_transaction" };
  const order = txn.orders as { id: string; status: string; payment_status: string; total_bdt: number } | null;
  if (!order) return { code: 404, result: "unknown_transaction" };

  // Store the raw IPN first, whatever happens next.
  await admin.from("payment_transactions").update({ raw_ipn_payload: raw as never }).eq("id", txn.id);

  // Idempotency: a validated transaction is never re-processed.
  if (txn.status === "validated" || order.payment_status === "paid") {
    await appendOrderEvent(order.id, "ipn_duplicate", { note: `Duplicate IPN for ${ipn.tran_id} ignored` });
    return { code: 200, result: "already_processed" };
  }

  const status = ipn.status.toUpperCase();
  if (status === "FAILED" || status === "CANCELLED") {
    const newStatus = status === "FAILED" ? "failed" : "cancelled";
    await admin.from("payment_transactions").update({ status: newStatus }).eq("id", txn.id);
    await admin.from("orders").update({ payment_status: "failed" }).eq("id", order.id);
    await appendOrderEvent(order.id, `payment_${newStatus}`, { note: `Gateway reported ${status} for ${ipn.tran_id}` });
    return { code: 200, result: newStatus };
  }

  if (status !== "VALID" && status !== "VALIDATED") {
    return { code: 202, result: "rejected", reason: `unexpected status ${ipn.status}` };
  }
  if (!ipn.val_id) return reject(order.id, txn.id, "missing val_id");

  // Server-to-server validation with the gateway. The IPN body is not trusted.
  const validation = await getPayment().validate(ipn.val_id);
  await admin
    .from("payment_transactions")
    .update({ raw_validation_response: (validation.raw ?? validation) as never, val_id: ipn.val_id })
    .eq("id", txn.id);

  const reasons: string[] = [];
  if (validation.status !== "VALID" && validation.status !== "VALIDATED") reasons.push(`validation status ${validation.status}`);
  if (validation.tranId !== ipn.tran_id) reasons.push("tran_id mismatch between IPN and validation");
  if (validation.currency !== "BDT") reasons.push(`validated currency ${validation.currency} is not BDT`);
  if (ipn.currency.toUpperCase() !== "BDT") reasons.push(`IPN currency ${ipn.currency} is not BDT`);
  if (Math.round(validation.amountBdt) !== order.total_bdt) reasons.push(`validated amount ${validation.amountBdt} != order total ${order.total_bdt}`);
  if (Math.round(ipn.amount) !== order.total_bdt) reasons.push(`IPN amount ${ipn.amount} != order total ${order.total_bdt}`);
  if (reasons.length) return reject(order.id, txn.id, reasons.join("; "));

  await admin
    .from("payment_transactions")
    .update({
      status: "validated",
      validated_at: new Date().toISOString(),
      bank_txn_id: validation.bankTxnId ?? ipn.bank_tran_id ?? null,
      card_type: validation.cardType ?? ipn.card_type ?? null,
      card_issuer: validation.cardIssuer ?? ipn.card_issuer ?? null,
    })
    .eq("id", txn.id);
  await admin.from("orders").update({ payment_status: "paid" }).eq("id", order.id);
  if (order.status === "pending_payment" || order.status === "awaiting_advance") {
    await transitionOrder(order.id, "confirmed", { eventType: "payment_validated", note: `Payment ${ipn.tran_id} validated: ৳${order.total_bdt}` });
    const { data: o } = await admin.from("orders").select("order_number, customer_phone").eq("id", order.id).single();
    if (o) await notifyConfirmed(order.id, o.order_number, order.total_bdt, o.customer_phone).catch((e) => console.warn("[ipn] confirmation SMS failed:", e));
  } else {
    await appendOrderEvent(order.id, "payment_validated", { note: `Payment ${ipn.tran_id} validated` });
  }
  return { code: 200, result: "paid" };
}

/**
 * Reconciliation (BUILD_PROMPT §9 "IPN never arriving"): for initiated
 * transactions older than `olderThanMinutes`, ask the gateway. VALID -> run the
 * exact same validation path as an IPN; FAILED/CANCELLED -> mark failed;
 * PENDING/unknown -> leave for the next run.
 */
export async function reconcilePendingPayments(olderThanMinutes = 30, limit = 50) {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000).toISOString();
  const { data: txns } = await admin
    .from("payment_transactions")
    .select("id, gateway_txn_id, order_id, amount_bdt, currency, created_at, orders(payment_status, order_number)")
    .eq("status", "initiated")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(limit);
  const gateway = getPayment();
  const results: Array<{ txn: string; action: string }> = [];
  for (const t of txns ?? []) {
    if (!t.gateway_txn_id) continue;
    const order = t.orders as { payment_status: string; order_number: string } | null;
    if (!order || order.payment_status === "paid") continue;
    let lookup;
    try {
      lookup = await gateway.lookupTransaction(t.gateway_txn_id);
    } catch (e) {
      results.push({ txn: t.gateway_txn_id, action: `lookup failed: ${e instanceof Error ? e.message : e}` });
      continue;
    }
    if (lookup.status === "VALID" || lookup.status === "VALIDATED") {
      const outcome = await processIpn({ tran_id: t.gateway_txn_id, val_id: lookup.valId ?? "", amount: String(lookup.amountBdt ?? t.amount_bdt), currency: lookup.currency ?? t.currency, status: "VALID", _source: "reconcile" });
      results.push({ txn: t.gateway_txn_id, action: `reconciled: ${outcome.result}` });
    } else if (lookup.status === "FAILED" || lookup.status === "CANCELLED" || lookup.status === "EXPIRED" || !lookup.found) {
      await admin.from("payment_transactions").update({ status: "failed", raw_validation_response: (lookup.raw ?? lookup) as never }).eq("id", t.id);
      await admin.from("orders").update({ payment_status: "failed" }).eq("id", t.order_id);
      await appendOrderEvent(t.order_id, "payment_reconciled_failed", { note: `Gateway reports ${lookup.found ? lookup.status : "unknown transaction"} for ${t.gateway_txn_id}; customer may retry` });
      results.push({ txn: t.gateway_txn_id, action: "marked failed" });
    } else {
      results.push({ txn: t.gateway_txn_id, action: "still pending" });
    }
  }
  return { checked: txns?.length ?? 0, results };
}

async function reject(orderId: string, txnId: string, reason: string): Promise<IpnOutcome> {
  await appendOrderEvent(orderId, "payment_rejected", { note: `IPN rejected: ${reason}`, metadata: { txn_id: txnId } });
  console.warn(`[ipn] rejected for order ${orderId}: ${reason}`);
  return { code: 202, result: "rejected", reason };
}
