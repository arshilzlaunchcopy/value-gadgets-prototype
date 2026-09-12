import "server-only";

import { isDemoMode, requireEnv } from "@/lib/env";
import { MockPaymentAdapter } from "./mock";
import { SslCommerzAdapter } from "./sslcommerz";
import type { PaymentAdapter } from "./types";

export type { Order, PaymentAdapter, PaymentSession, RefundResult, ValidationResult } from "./types";

let instance: PaymentAdapter | null = null;

export function getPayment(): PaymentAdapter {
  if (instance) return instance;
  instance = isDemoMode()
    ? new MockPaymentAdapter(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000")
    : new SslCommerzAdapter({
        storeId: requireEnv("SSLCZ_STORE_ID"),
        storePassword: requireEnv("SSLCZ_STORE_PASSWD"),
        sandbox: process.env.SSLCZ_SANDBOX !== "false",
        siteUrl: requireEnv("NEXT_PUBLIC_SITE_URL"),
      });
  return instance;
}

/** Demo-only: the mock gateway page needs the mock's extra method. */
export function getMockPayment(): MockPaymentAdapter {
  const p = getPayment();
  if (!(p instanceof MockPaymentAdapter)) throw new Error("Mock gateway is only available in DEMO_MODE");
  return p;
}
