export type SmsKind = "otp" | "order_confirmed" | "shipped" | "delivered" | "abandoned_cart" | "advance_payment" | "other";

export interface SmsResult {
  ok: boolean;
  /** Provider message id, or the demo_sms_log row id for the mock */
  providerRef?: string;
  error?: string;
  /** Demo only: the OTP code parsed from the message so the UI can surface it */
  debugCode?: string;
}

/**
 * SmsAdapter (BUILD_PROMPT_PART3 §20.1). `to` is E.164 (+8801...).
 */
export interface SmsAdapter {
  readonly name: string;
  readonly isMock: boolean;
  send(to: string, message: string, kind: SmsKind): Promise<SmsResult>;
}
