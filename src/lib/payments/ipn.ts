import "server-only";

import { z } from "zod";
import { getPayment } from "@/lib/integrations/payment";
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
  if (validation.currency !== "BDT") reasons.push(`currency ${validation.currency} is not BDT`);
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
  } else {
    await appendOrderEvent(order.id, "payment_validated", { note: `Payment ${ipn.tran_id} validated` });
  }
  return { code: 200, result: "paid" };
}

async function reject(orderId: string, txnId: string, reason: string): Promise<IpnOutcome> {
  await appendOrderEvent(orderId, "payment_rejected", { note: `IPN rejected: ${reason}`, metadata: { txn_id: txnId } });
  console.warn(`[ipn] rejected for order ${orderId}: ${reason}`);
  return { code: 202, result: "rejected", reason };
}
