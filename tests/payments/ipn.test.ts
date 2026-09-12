import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getMockPayment } from "@/lib/integrations/payment";
import { processIpn } from "@/lib/payments/ipn";
import { createTestOrder } from "../helpers/fixtures";

/**
 * BUILD_PROMPT §9: "Write a test that forges a success redirect with a tampered
 * amount and asserts the order remains unpaid. If that test does not exist,
 * this feature is not done."
 *
 * Runs the real processIpn (the /api/payment/ipn handler's logic) against the
 * mock gateway on the demo database.
 */
describe("IPN validation", () => {
  const TOTAL = 4320;
  let fx: Awaited<ReturnType<typeof createTestOrder>>;
  let txnId: string;

  beforeAll(async () => {
    fx = await createTestOrder({ total: TOTAL });
    const session = await getMockPayment().createSession(fx.order);
    txnId = session.txnId;
    expect(txnId).toMatch(/^MOCK-/);
  });

  afterAll(async () => {
    await fx?.cleanup();
  });

  it("rejects a forged success IPN whose val_id the gateway never issued", async () => {
    const out = await processIpn({ tran_id: txnId, val_id: "VAL-FORGED", amount: TOTAL.toFixed(2), currency: "BDT", status: "VALID" });
    expect(out.result).toBe("rejected");
    expect((await fx.paymentStatus()).payment_status).toBe("unpaid");
  });

  it("rejects a success IPN with a tampered amount even when the gateway validated the payment", async () => {
    const { payload } = await getMockPayment().recordOutcome(txnId, "success", "bkash");
    const tampered = { ...payload, amount: (TOTAL + 500).toFixed(2), store_amount: (TOTAL + 500).toFixed(2) };
    const out = await processIpn(tampered);
    expect(out.result).toBe("rejected");
    expect(out).toMatchObject({ code: 202 });
    const state = await fx.paymentStatus();
    expect(state.payment_status).toBe("unpaid");
    expect(state.status).toBe("pending_payment");
    const events = await fx.events();
    expect(events.some((e) => e.event_type === "payment_rejected" && /amount/i.test(e.note ?? ""))).toBe(true);
  });

  it("rejects a currency other than BDT", async () => {
    const { payload } = await getMockPayment().recordOutcome(txnId, "success", "bkash");
    const out = await processIpn({ ...payload, currency: "USD" });
    expect(out.result).toBe("rejected");
    expect((await fx.paymentStatus()).payment_status).toBe("unpaid");
  });

  it("returns 404 for an unknown tran_id", async () => {
    const out = await processIpn({ tran_id: "MOCK-DOES-NOT-EXIST", val_id: "x", amount: "1", currency: "BDT", status: "VALID" });
    expect(out.code).toBe(404);
  });

  it("marks the order paid + confirmed (then auto-dispatched) for the honest payload, then ignores a duplicate", async () => {
    const { payload } = await getMockPayment().recordOutcome(txnId, "success", "bkash");
    const first = await processIpn(payload);
    expect(first.result).toBe("paid");
    const state = await fx.paymentStatus();
    expect(state.payment_status).toBe("paid");
    // PART2 §14.3: paid online + score below the review line -> auto-confirm -> auto-dispatch
    expect(["confirmed", "shipped"]).toContain(state.status);

    const again = await processIpn(payload);
    expect(again.result).toBe("already_processed");

    // and a tampered replay after payment is still not a second success
    const replay = await processIpn({ ...payload, amount: "1.00" });
    expect(replay.result).toBe("already_processed");
  });
});
