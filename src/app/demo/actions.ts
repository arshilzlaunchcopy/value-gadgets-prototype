"use server";

import { revalidatePath } from "next/cache";
import { runCourierTick } from "@/lib/demo/courier-tick";
import { setDemoSettings, type DemoSettings } from "@/lib/demo/settings";
import { isDemoMode } from "@/lib/env";
import { getMockPayment } from "@/lib/integrations/payment";
import { dispatchOrder } from "@/lib/orders/dispatch";
import { transitionOrder, type OrderStatus } from "@/lib/orders/status";
import { processIpn } from "@/lib/payments/ipn";
import { generateOrders, resetAll, resetTransactional, seedAll } from "@/lib/seed";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ActionResult {
  ok: boolean;
  message: string;
  detail?: unknown;
}

function guard(): void {
  if (!isDemoMode()) throw new Error("Demo mode is off");
}

async function run(label: string, fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    guard();
    const detail = await fn();
    revalidatePath("/demo");
    return { ok: true, message: label, detail };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[demo] ${label} failed:`, message);
    return { ok: false, message: `${label} failed: ${message}` };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- settings
export async function updateDemoSettings(patch: Partial<DemoSettings>): Promise<ActionResult> {
  return run("Settings saved", () => setDemoSettings(patch));
}

// ------------------------------------------------------------------ orders
export async function forceOrderStatus(orderId: string, to: OrderStatus): Promise<ActionResult> {
  return run(`Order set to ${to}`, async () => {
    if (to === "shipped") return dispatchOrder(orderId, { actorType: "admin" });
    return transitionOrder(orderId, to, { actorType: "admin", note: "Forced from demo panel", force: true });
  });
}

/** Placed -> delivered in ~8 s (BUILD_PROMPT_PART3 §22). The panel polls while this runs. */
export async function runFullLifecycle(orderId: string): Promise<ActionResult> {
  return run("Lifecycle complete", async () => {
    const admin = createAdminClient();
    const { data: o } = await admin.from("orders").select("status, payment_method, payment_status").eq("id", orderId).single();
    if (!o) throw new Error("order not found");
    if (o.status === "pending_payment" || o.status === "awaiting_advance") {
      await transitionOrder(orderId, "confirmed", { actorType: "admin", note: "Lifecycle: confirmed" });
      await sleep(1500);
    }
    if (["confirmed"].includes(o.status) || o.status === "pending_payment" || o.status === "awaiting_advance") {
      await transitionOrder(orderId, "processing", { actorType: "admin", note: "Lifecycle: processing" });
      await sleep(1500);
      await transitionOrder(orderId, "packed", { actorType: "admin", note: "Lifecycle: packed" });
      await sleep(1500);
    }
    await dispatchOrder(orderId, { actorType: "admin" });
    await sleep(1500);
    // walk the courier chain to the end regardless of configured speed
    const tick = await runCourierTick({ orderId, force: true });
    return tick;
  });
}

export async function forceIntoReviewQueue(orderId: string): Promise<ActionResult> {
  return run("Order sent to review queue", async () => {
    const admin = createAdminClient();
    const { error } = await admin
      .from("orders")
      .update({ needs_review: true, fraud_score: 65, fraud_flags: ["forced from demo panel (+65)"] as never })
      .eq("id", orderId);
    if (error) throw new Error(error.message);
    await admin.from("order_events").insert({ order_id: orderId, event_type: "fraud_flagged", actor_type: "admin", note: "Forced into review queue from demo panel" });
  });
}

export async function triggerReturn(orderId: string): Promise<ActionResult> {
  return run("Return recorded", async () => {
    const admin = createAdminClient();
    const { data: shipment } = await admin.from("shipments").select("id").eq("order_id", orderId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (shipment) await admin.from("shipments").update({ normalized_status: "returned", status: "returned" }).eq("id", shipment.id);
    return transitionOrder(orderId, "returned", { actorType: "admin", note: "Return triggered from demo panel", force: true });
  });
}

// ---------------------------------------------------------------- payments
export type IpnKind = "success" | "failed" | "timeout" | "tampered";

export async function firePaymentIpn(orderId: string, kind: IpnKind): Promise<ActionResult> {
  return run(`IPN (${kind}) fired`, async () => {
    const admin = createAdminClient();
    const { data: order } = await admin.from("orders").select("*").eq("id", orderId).single();
    if (!order) throw new Error("order not found");
    if (order.payment_status === "paid") throw new Error(`${order.order_number} is already paid - a repeat IPN is ignored as a duplicate. Pick an unpaid order.`);
    const mock = getMockPayment();

    let { data: txn } = await admin
      .from("payment_transactions")
      .select("gateway_txn_id, status")
      .eq("order_id", orderId)
      .eq("gateway", "mock")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!txn || txn.status !== "initiated") {
      const session = await mock.createSession(order);
      txn = { gateway_txn_id: session.txnId, status: "initiated" };
    }
    const txnId = txn.gateway_txn_id!;

    if (kind === "timeout") {
      await admin.from("order_events").insert({
        order_id: orderId,
        event_type: "ipn_timeout_simulated",
        actor_type: "admin",
        note: "Simulated: customer paid but no IPN arrived. Reconciliation cron (phase 8) will query the gateway.",
      });
      return { txnId, note: "no IPN sent" };
    }

    const { payload } = await mock.recordOutcome(txnId, kind === "failed" ? "failed" : "success", "bkash");
    if (kind === "tampered") {
      payload.amount = (order.total_bdt + 500).toFixed(2); // forged amount
      payload.store_amount = payload.amount;
    }
    const outcome = await processIpn(payload);
    if (kind === "tampered" && outcome.result !== "rejected") throw new Error(`TAMPERED IPN WAS ACCEPTED: ${JSON.stringify(outcome)}`);
    return { txnId, outcome };
  });
}

// ----------------------------------------------------------------- courier
export async function courierTick(force = false): Promise<ActionResult> {
  return run("Courier tick", () => runCourierTick({ force }));
}

// -------------------------------------------------------------------- data
export async function generateDemoOrders(n: number): Promise<ActionResult> {
  return run(`${n} orders generated`, () => generateOrders(Math.max(1, Math.min(200, Math.floor(n)))));
}

export async function jumpClock(days: number): Promise<ActionResult> {
  return run(`Clock moved ${days} day(s)`, async () => {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("demo_shift_clock", { days: Math.floor(days) });
    if (error) throw new Error(error.message);
    return { orders_shifted: data };
  });
}

export async function resetTransactionalData(): Promise<ActionResult> {
  return run("Transactional data reset + re-seeded", () => resetTransactional());
}

export async function resetAllData(): Promise<ActionResult> {
  return run("Everything reset + re-seeded", () => resetAll());
}

export async function seedEverything(): Promise<ActionResult> {
  return run("Seed complete", () => seedAll());
}
