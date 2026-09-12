import "server-only";

import { getDemoSetting } from "@/lib/demo/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SmsAdapter, SmsKind, SmsResult } from "./types";

/**
 * MockSmsAdapter (BUILD_PROMPT_PART3 §20.1).
 * - writes demo_sms_log instead of sending
 * - ~400 ms simulated latency so loading states are visible
 * - failure rate from demo_settings.sms_failure_rate (default 5%)
 * - surfaces the OTP code (debugCode) so the demo panel / toast can show it
 */
export class MockSmsAdapter implements SmsAdapter {
  readonly name = "mock-sms";
  readonly isMock = true;

  async send(to: string, message: string, kind: SmsKind): Promise<SmsResult> {
    await new Promise((r) => setTimeout(r, 400));
    const failureRate = await getDemoSetting("sms_failure_rate");
    const failed = Math.random() < failureRate;
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("demo_sms_log")
      .insert({
        to_phone: to,
        message,
        kind,
        status: failed ? "failed" : "sent",
        provider: "mock",
        error: failed ? "Simulated gateway failure (demo_settings.sms_failure_rate)" : null,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: `demo_sms_log insert failed: ${error.message}` };
    const debugCode = kind === "otp" ? (/\b(\d{6})\b/.exec(message)?.[1] ?? undefined) : undefined;
    return failed
      ? { ok: false, providerRef: data.id, error: "Simulated SMS gateway failure", debugCode }
      : { ok: true, providerRef: data.id, debugCode };
  }
}
