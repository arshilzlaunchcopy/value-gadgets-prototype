import type { Tables } from "@/lib/database.types";

export type Order = Tables<"orders">;

export interface PaymentSession {
  /** Where to send the browser */
  redirectUrl: string;
  /** Gateway transaction id (SSLCommerz tran_id). Stored in payment_transactions.gateway_txn_id */
  txnId: string;
  /** Raw gateway response, stored verbatim */
  raw?: unknown;
}

export type ValidationStatus = "VALID" | "VALIDATED" | "INVALID" | "FAILED" | "CANCELLED" | "UNATTEMPTED" | "EXPIRED";

export interface ValidationResult {
  status: ValidationStatus;
  /** Amount the gateway actually captured, in whole taka */
  amountBdt: number;
  currency: string;
  tranId: string;
  valId: string;
  bankTxnId?: string;
  cardType?: string;
  cardIssuer?: string;
  raw?: unknown;
}

export interface RefundResult {
  ok: boolean;
  refundRef?: string;
  raw?: unknown;
  error?: string;
}

/**
 * PaymentAdapter (BUILD_PROMPT_PART3 §20.2, BUILD_PROMPT §9).
 * Application code calls getPayment() and never a concrete class.
 */
export interface LookupResult {
  found: boolean;
  status: ValidationStatus | "PENDING";
  valId?: string;
  amountBdt?: number;
  currency?: string;
  raw?: unknown;
}

export interface PaymentAdapter {
  readonly name: string;
  readonly isMock: boolean;
  createSession(order: Order): Promise<PaymentSession>;
  validate(valId: string): Promise<ValidationResult>;
  refund(txnId: string, amountBdt: number, reason?: string): Promise<RefundResult>;
  /** Reconciliation: what does the gateway know about this tran_id? (BUILD_PROMPT §9, "IPN never arriving") */
  lookupTransaction(txnId: string): Promise<LookupResult>;
}
