import "server-only";

import { isDemoMode } from "@/lib/env";
import { isR2Configured } from "@/lib/media/storage";
import { getCourier } from "./courier";
import { getCourierScore } from "./fraud";
import { getPayment } from "./payment";
import { getSms } from "./sms";

export { getCourier } from "./courier";
export { getCourierScore } from "./fraud";
export { getPayment } from "./payment";
export { getSms } from "./sms";

export interface AdapterStatus {
  integration: "payment" | "sms" | "courier" | "courier_score" | "media_storage";
  adapter: string;
  mode: "mock" | "live";
  note?: string;
}

/** Environment readout for the demo panel (BUILD_PROMPT_PART3 §22). */
export function getAdapterStatus(): AdapterStatus[] {
  const demo = isDemoMode();
  const safe = <T>(fn: () => T, fallback: T): T => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };
  return [
    { integration: "payment", adapter: safe(() => getPayment().name, "unavailable"), mode: demo ? "mock" : "live" },
    { integration: "sms", adapter: safe(() => getSms().name, "unavailable"), mode: demo ? "mock" : "live" },
    { integration: "courier", adapter: safe(() => getCourier().name, "unavailable"), mode: demo ? "mock" : "live" },
    { integration: "courier_score", adapter: safe(() => getCourierScore().name, "unavailable"), mode: demo ? "mock" : "live" },
    {
      integration: "media_storage",
      adapter: isR2Configured() ? "Cloudflare R2" : "Supabase Storage (R2 fallback)",
      mode: isR2Configured() ? "live" : "mock",
      note: isR2Configured() ? undefined : "R2 credentials blank",
    },
  ];
}
