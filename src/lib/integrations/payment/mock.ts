import "server-only";

import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Order, PaymentAdapter, PaymentSession, RefundResult, ValidationResult } from "./types";

export const MOCK_GATEWAY = "mock";

/**
 * MockPaymentAdapter (BUILD_PROMPT_PART3 §20.2).
 *
 * - createSession records an `initiated` payment_transactions row and sends the
 *   browser to /demo/gateway, a fake BD gateway page.
 * - The gateway page's "Pay" outcome is recorded via recordOutcome(), which
 *   then fires a real POST to /api/payment/ipn with an SSLCommerz-shaped payload.
 * - validate() returns VALID only for transactions the gateway recorded as
 *   successful - so the real IPN handler + amount check are fully exercised.
 */
export class MockPaymentAdapter implements PaymentAdapter {
  readonly name = "mock-gateway";
  readonly isMock = true;

  constructor(private readonly siteUrl: string) {}

  async createSession(order: Order): Promise<PaymentSession> {
    const admin = createAdminClient();
    const txnId = `MOCK-${order.order_number}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const raw = { gateway: MOCK_GATEWAY, status: "SUCCESS", sessionkey: txnId, created_at: new Date().toISOString() };
    const { error } = await admin.from("payment_transactions").insert({
      order_id: order.id,
      gateway: MOCK_GATEWAY,
      gateway_txn_id: txnId,
      amount_bdt: order.total_bdt,
      currency: "BDT",
      status: "initiated",
      raw_initiate_response: raw,
    });
    if (error) throw new Error(`mock createSession failed: ${error.message}`);
    const url = new URL("/demo/gateway", this.siteUrl);
    url.searchParams.set("txn", txnId);
    url.searchParams.set("amount", String(order.total_bdt));
    url.searchParams.set("order", order.order_number);
    return { redirectUrl: url.toString(), txnId, raw };
  }

  async validate(valId: string): Promise<ValidationResult> {
    const admin = createAdminClient();
    const { data: txn } = await admin
      .from("payment_transactions")
      .select("gateway_txn_id, val_id, bank_txn_id, amount_bdt, currency, status, card_type, card_issuer")
      .eq("gateway", MOCK_GATEWAY)
      .eq("val_id", valId)
      .maybeSingle();
    if (!txn || !txn.gateway_txn_id) {
      return { status: "INVALID", amountBdt: 0, currency: "BDT", tranId: "", valId, raw: { reason: "unknown val_id" } };
    }
    const ok = txn.status === "success" || txn.status === "validated";
    return {
      status: ok ? "VALID" : txn.status === "cancelled" ? "CANCELLED" : "FAILED",
      amountBdt: txn.amount_bdt,
      currency: txn.currency,
      tranId: txn.gateway_txn_id,
      valId,
      bankTxnId: txn.bank_txn_id ?? undefined,
      cardType: txn.card_type ?? undefined,
      cardIssuer: txn.card_issuer ?? undefined,
      raw: { source: "mock-gateway", recorded_status: txn.status },
    };
  }

  async refund(txnId: string, amountBdt: number, reason?: string): Promise<RefundResult> {
    const admin = createAdminClient();
    const { data: txn } = await admin
      .from("payment_transactions")
      .select("id, amount_bdt, status")
      .eq("gateway", MOCK_GATEWAY)
      .eq("gateway_txn_id", txnId)
      .maybeSingle();
    if (!txn) return { ok: false, error: "unknown transaction" };
    if (txn.status !== "validated" && txn.status !== "success") return { ok: false, error: `cannot refund a ${txn.status} transaction` };
    if (amountBdt > txn.amount_bdt) return { ok: false, error: "refund exceeds captured amount" };
    const refundRef = `RF-${randomBytes(4).toString("hex").toUpperCase()}`;
    await admin.from("payment_transactions").update({ status: "refunded" }).eq("id", txn.id);
    return { ok: true, refundRef, raw: { reason, amountBdt } };
  }

  /**
   * Called by the fake gateway page. Records what the "bank" did and returns
   * the SSLCommerz-shaped IPN payload the caller should POST to /api/payment/ipn.
   */
  async recordOutcome(
    txnId: string,
    outcome: "success" | "failed" | "cancelled",
    method: "card" | "bkash" | "nagad" = "card",
  ): Promise<{ payload: Record<string, string>; orderNumber: string | null }> {
    const admin = createAdminClient();
    const { data: txn } = await admin
      .from("payment_transactions")
      .select("id, order_id, amount_bdt, currency, status, orders(order_number)")
      .eq("gateway", MOCK_GATEWAY)
      .eq("gateway_txn_id", txnId)
      .maybeSingle();
    if (!txn) throw new Error("Unknown mock transaction");

    const valId = outcome === "success" ? `VAL-${randomBytes(6).toString("hex").toUpperCase()}` : "";
    const bankTxnId = outcome === "success" ? `BANK${Date.now()}` : "";
    const cardType = method === "card" ? "VISA-Dutch Bangla" : method === "bkash" ? "BKASH-BKash" : "NAGAD-Nagad";
    const cardIssuer = method === "card" ? "DUTCH BANGLA BANK" : method === "bkash" ? "bKash Mobile Banking" : "Nagad";

    if (txn.status === "initiated") {
      await admin
        .from("payment_transactions")
        .update({
          status: outcome,
          val_id: valId || null,
          bank_txn_id: bankTxnId || null,
          card_type: cardType,
          card_issuer: cardIssuer,
        })
        .eq("id", txn.id);
    }

    const status = outcome === "success" ? "VALID" : outcome === "failed" ? "FAILED" : "CANCELLED";
    const orderNumber = (txn.orders as { order_number: string } | null)?.order_number ?? null;
    const payload: Record<string, string> = {
      tran_id: txnId,
      val_id: valId,
      amount: txn.amount_bdt.toFixed(2),
      store_amount: (txn.amount_bdt * 0.975).toFixed(2),
      currency: txn.currency,
      status,
      tran_date: new Date().toISOString().slice(0, 19).replace("T", " "),
      bank_tran_id: bankTxnId,
      card_type: cardType,
      card_issuer: cardIssuer,
      card_brand: method === "card" ? "VISA" : method.toUpperCase(),
      card_no: method === "card" ? "432149XXXXXX0011" : "",
      risk_level: "0",
      risk_title: "Safe",
      verify_sign: randomBytes(16).toString("hex"),
      verify_key: "amount,bank_tran_id,card_type,currency,status,tran_id,val_id",
    };
    return { payload, orderNumber };
  }
}
