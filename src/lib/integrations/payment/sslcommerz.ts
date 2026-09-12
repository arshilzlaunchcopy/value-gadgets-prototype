import "server-only";

import type { Order, PaymentAdapter, PaymentSession, RefundResult, ValidationResult } from "./types";

export interface SslCommerzConfig {
  storeId: string;
  storePassword: string;
  /** true = sandbox.sslcommerz.com, false = securepay.sslcommerz.com */
  sandbox: boolean;
  siteUrl: string;
}

/**
 * Real SSLCommerz adapter. Signatures are final; bodies are implemented in
 * phase 17 (go-live). See BUILD_PROMPT §9 for the flow.
 */
export class SslCommerzAdapter implements PaymentAdapter {
  readonly name = "sslcommerz";
  readonly isMock = false;

  constructor(private readonly cfg: SslCommerzConfig) {}

  /** POST https://{sandbox|securepay}.sslcommerz.com/gwprocess/v4/api.php */
  async createSession(_order: Order): Promise<PaymentSession> {
    void this.cfg;
    throw new Error("SslCommerzAdapter.createSession not implemented");
  }

  /** GET https://{host}/validator/api/validationserverAPI.php?val_id=... */
  async validate(_valId: string): Promise<ValidationResult> {
    throw new Error("SslCommerzAdapter.validate not implemented");
  }

  /** GET https://{host}/validator/api/merchantTransIDvalidationAPI.php?refund_amount=... */
  async refund(_txnId: string, _amountBdt: number, _reason?: string): Promise<RefundResult> {
    throw new Error("SslCommerzAdapter.refund not implemented");
  }
}
