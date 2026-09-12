import "server-only";

import { isDemoMode, requireEnv } from "@/lib/env";
import { AlphaSmsAdapter } from "./alpha-sms";
import { MockSmsAdapter } from "./mock";
import type { SmsAdapter } from "./types";

export type { SmsAdapter, SmsKind, SmsResult } from "./types";

let instance: SmsAdapter | null = null;

export function getSms(): SmsAdapter {
  if (instance) return instance;
  instance = isDemoMode()
    ? new MockSmsAdapter()
    : new AlphaSmsAdapter({ apiKey: requireEnv("SMS_API_KEY"), senderId: process.env.SMS_SENDER_ID });
  return instance;
}
