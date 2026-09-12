import "server-only";

import { randomInt } from "node:crypto";
import { getDemoSetting, setDemoSetting } from "@/lib/demo/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  BulkResult,
  CourierAdapter,
  CourierStatus,
  DispatchPayload,
  DispatchResult,
  NormalizedCourierStatus,
  ReturnRequest,
  ReturnResult,
} from "./types";

const ALNUM = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function trackingCode(): string {
  let s = "VG";
  for (let i = 0; i < 9; i++) s += ALNUM[randomInt(ALNUM.length)];
  return s;
}

function consignmentId(): string {
  return `1${String(randomInt(0, 10_000_000)).padStart(7, "0")}`;
}

export class CourierOutageError extends Error {
  constructor() {
    super("Simulated courier API outage (demo_settings.courier_outage)");
    this.name = "CourierOutageError";
  }
}

/**
 * MockCourierAdapter (BUILD_PROMPT_PART3 §20.3).
 * - plausible ids: consignment 1 + 7 digits, tracking VG + 9 alnum
 * - balance starts at 25,000 and decreases per parcel
 * - outage flag makes every call throw (to demo graceful degradation)
 * - status auto-advance lives in src/lib/demo/courier-tick.ts
 */
export class MockCourierAdapter implements CourierAdapter {
  readonly name = "Mock Courier";
  readonly code = "mock";
  readonly isMock = true;

  private async guard(): Promise<void> {
    if (await getDemoSetting("courier_outage")) throw new CourierOutageError();
    await new Promise((r) => setTimeout(r, 250));
  }

  async createOrder(p: DispatchPayload): Promise<DispatchResult> {
    await this.guard();
    const balance = await getDemoSetting("courier_balance");
    await setDemoSetting("courier_balance", Math.max(0, balance - 60));
    const result: DispatchResult = {
      consignmentId: consignmentId(),
      trackingCode: trackingCode(),
      status: "in_review",
      raw: {
        status: 200,
        message: "Consignment has been created successfully.",
        consignment: { invoice: p.invoice, recipient_name: p.recipientName, recipient_phone: p.recipientPhone, cod_amount: p.codAmountBdt, status: "in_review" },
      },
    };
    return result;
  }

  async createBulkOrders(payloads: DispatchPayload[]): Promise<BulkResult> {
    await this.guard();
    const results: BulkResult["results"] = [];
    for (const p of payloads) {
      try {
        const r = await this.createOrder(p);
        results.push({ invoice: p.invoice, ok: true, consignmentId: r.consignmentId, trackingCode: r.trackingCode });
      } catch (e) {
        results.push({ invoice: p.invoice, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return { results };
  }

  private toStatus(row: { status: string | null; normalized_status: string; consignment_id: string | null; tracking_code: string | null; updated_at: string } | null): CourierStatus {
    if (!row) return { rawStatus: "unknown", normalized: "on_hold", raw: { status: 404 } };
    return {
      rawStatus: row.status ?? row.normalized_status,
      normalized: row.normalized_status as NormalizedCourierStatus,
      consignmentId: row.consignment_id ?? undefined,
      trackingCode: row.tracking_code ?? undefined,
      updatedAt: row.updated_at,
      raw: { status: 200, delivery_status: row.status },
    };
  }

  async statusByInvoice(invoice: string): Promise<CourierStatus> {
    await this.guard();
    const { data } = await createAdminClient()
      .from("shipments")
      .select("status, normalized_status, consignment_id, tracking_code, updated_at")
      .eq("courier_code", this.code)
      .eq("invoice_ref", invoice)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return this.toStatus(data);
  }

  async statusByConsignmentId(id: string): Promise<CourierStatus> {
    await this.guard();
    const { data } = await createAdminClient()
      .from("shipments")
      .select("status, normalized_status, consignment_id, tracking_code, updated_at")
      .eq("courier_code", this.code)
      .eq("consignment_id", id)
      .maybeSingle();
    return this.toStatus(data);
  }

  async statusByTrackingCode(code: string): Promise<CourierStatus> {
    await this.guard();
    const { data } = await createAdminClient()
      .from("shipments")
      .select("status, normalized_status, consignment_id, tracking_code, updated_at")
      .eq("courier_code", this.code)
      .eq("tracking_code", code)
      .maybeSingle();
    return this.toStatus(data);
  }

  async getBalance(): Promise<number> {
    await this.guard();
    return getDemoSetting("courier_balance");
  }

  async createReturnRequest(r: ReturnRequest): Promise<ReturnResult> {
    await this.guard();
    return { ok: true, returnRef: `RET-${r.consignmentId}`, raw: { status: 200, message: "Return request created" } };
  }
}
