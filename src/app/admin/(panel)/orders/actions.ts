"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { getCourier } from "@/lib/integrations/courier";
import { dispatchOrder } from "@/lib/orders/dispatch";
import { notifyConfirmed } from "@/lib/orders/create";
import { ORDER_STATUSES, transitionOrder, appendOrderEvent } from "@/lib/orders/status";
import { createAdminClient } from "@/lib/supabase/admin";

type R = { ok: boolean; error?: string; message?: string };
const uuid = z.string().uuid();
const statusSchema = z.enum(ORDER_STATUSES);

function fail(e: unknown): R {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

export async function setOrderStatusAction(orderId: string, status: string, note?: string): Promise<R> {
  try {
    const s = await requireAdmin();
    const id = uuid.parse(orderId);
    const to = statusSchema.parse(status);
    if (to === "shipped") {
      await dispatchOrder(id, { actorType: "admin", actorId: s.userId });
    } else {
      await transitionOrder(id, to, { actorType: "admin", actorId: s.userId, note: note?.trim() || undefined });
    }
    revalidatePath(`/admin/orders/${id}`);
    revalidatePath("/admin/orders");
    return { ok: true, message: `Order set to ${to}` };
  } catch (e) {
    return fail(e);
  }
}

export async function bulkStatusAction(orderIds: string[], status: string): Promise<R> {
  try {
    const s = await requireAdmin("manager");
    const ids = z.array(uuid).min(1).max(100).parse(orderIds);
    const to = statusSchema.parse(status);
    let n = 0;
    for (const id of ids) {
      if (to === "shipped") await dispatchOrder(id, { actorType: "admin", actorId: s.userId });
      else await transitionOrder(id, to, { actorType: "admin", actorId: s.userId, note: "Bulk update" });
      n++;
    }
    revalidatePath("/admin/orders");
    return { ok: true, message: `${n} order(s) set to ${to}` };
  } catch (e) {
    return fail(e);
  }
}

export interface BulkDispatchResult {
  orderId: string;
  orderNumber: string;
  ok: boolean;
  trackingCode?: string | null;
  error?: string;
}

/** Bulk dispatch (PART2 §14.7): one click, per-order success / failure. */
export async function bulkDispatchAction(orderIds: string[]): Promise<R & { results?: BulkDispatchResult[] }> {
  try {
    const s = await requireAdmin("manager");
    const ids = z.array(uuid).min(1).max(500).parse(orderIds);
    const admin = createAdminClient();
    const { data: orders } = await admin.from("orders").select("id, order_number, status").in("id", ids);
    const results: BulkDispatchResult[] = [];
    for (const o of orders ?? []) {
      if (!["confirmed", "processing", "packed"].includes(o.status)) {
        results.push({ orderId: o.id, orderNumber: o.order_number, ok: false, error: `status is ${o.status}` });
        continue;
      }
      try {
        const r = await dispatchOrder(o.id, { actorType: "admin", actorId: s.userId });
        results.push({ orderId: o.id, orderNumber: o.order_number, ok: true, trackingCode: r.trackingCode });
      } catch (e) {
        results.push({ orderId: o.id, orderNumber: o.order_number, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
    revalidatePath("/admin/orders");
    const okCount = results.filter((r) => r.ok).length;
    return { ok: true, message: `${okCount} of ${results.length} dispatched`, results };
  } catch (e) {
    return fail(e);
  }
}

export async function addAdminNoteAction(orderId: string, noteRaw: string): Promise<R> {
  try {
    const s = await requireAdmin();
    const id = uuid.parse(orderId);
    const note = z.string().trim().min(1).max(1000).parse(noteRaw);
    const admin = createAdminClient();
    const { data } = await admin.from("orders").select("admin_note").eq("id", id).single();
    const stamped = `[${new Date().toISOString().slice(0, 16).replace("T", " ")} ${s.email ?? "admin"}] ${note}`;
    await admin.from("orders").update({ admin_note: data?.admin_note ? `${data.admin_note}\n${stamped}` : stamped }).eq("id", id);
    await appendOrderEvent(id, "admin_note", { actorType: "admin", actorId: s.userId, note });
    revalidatePath(`/admin/orders/${id}`);
    return { ok: true, message: "Note added" };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Review Queue decision (BUILD_PROMPT §6.2): approve confirms the order (an
 * awaiting_advance order is released without the advance) and clears the
 * re-verification flag; cancel records a fraud cancellation so the phone
 * scores +50 next time.
 */
export async function markReviewedAction(orderId: string, approve: boolean): Promise<R> {
  try {
    const s = await requireAdmin();
    const id = uuid.parse(orderId);
    const admin = createAdminClient();
    const { data: o } = await admin.from("orders").select("status, order_number, total_bdt, customer_phone, payment_method").eq("id", id).single();
    if (!o) return { ok: false, error: "Order not found" };
    await admin.from("orders").update({ needs_review: false, otp_reverify_required: false }).eq("id", id);
    await appendOrderEvent(id, approve ? "review_approved" : "review_cancelled", { actorType: "admin", actorId: s.userId, note: approve ? "Approved from review queue" : "Cancelled from review queue" });
    if (!approve) {
      const stamped = `[${new Date().toISOString().slice(0, 16).replace("T", " ")} ${s.email ?? "admin"}] fraud review: cancelled`;
      const { data } = await admin.from("orders").select("admin_note").eq("id", id).single();
      await admin.from("orders").update({ admin_note: data?.admin_note ? `${data.admin_note}\n${stamped}` : stamped }).eq("id", id);
      await transitionOrder(id, "cancelled", { actorType: "admin", actorId: s.userId, note: "Fraud review: cancelled" });
    } else if (o.status === "awaiting_advance" || (o.status === "pending_payment" && o.payment_method === "cod")) {
      await transitionOrder(id, "confirmed", { actorType: "admin", actorId: s.userId, note: "Confirmed from review queue" });
      await notifyConfirmed(id, o.order_number, o.total_bdt, o.customer_phone).catch(() => undefined);
    }
    revalidatePath(`/admin/orders/${id}`);
    revalidatePath("/admin/orders");
    revalidatePath("/admin/orders/review");
    return { ok: true, message: approve ? "Approved" : "Cancelled" };
  } catch (e) {
    return fail(e);
  }
}

/** Clears the OTP re-verification requirement after the customer was reached (score >= 80, §4.6). */
export async function markPhoneReverifiedAction(orderId: string, how: string): Promise<R> {
  try {
    const s = await requireAdmin();
    const id = uuid.parse(orderId);
    await createAdminClient().from("orders").update({ otp_reverify_required: false, is_phone_verified: true }).eq("id", id);
    await appendOrderEvent(id, "phone_reverified", { actorType: "admin", actorId: s.userId, note: `Phone re-verified (${z.string().trim().max(120).parse(how) || "call"})` });
    revalidatePath(`/admin/orders/${id}`);
    return { ok: true, message: "Phone marked as re-verified" };
  } catch (e) {
    return fail(e);
  }
}

/** One-click return request to the courier for a refused delivery (PART2 §14.7). */
export async function createReturnRequestAction(orderId: string, reason?: string): Promise<R> {
  try {
    const s = await requireAdmin();
    const id = uuid.parse(orderId);
    const admin = createAdminClient();
    const { data: shipment } = await admin.from("shipments").select("id, consignment_id, invoice_ref, normalized_status").eq("order_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!shipment?.consignment_id) return { ok: false, error: "No shipment to return" };
    const r = await getCourier().createReturnRequest({ consignmentId: shipment.consignment_id, invoice: shipment.invoice_ref ?? "", reason: reason?.trim() || undefined });
    if (!r.ok) return { ok: false, error: r.error ?? "Courier rejected the return request" };
    await admin.from("shipments").update({ note: `return requested: ${r.returnRef ?? ""}` }).eq("id", shipment.id);
    await appendOrderEvent(id, "return_requested", { actorType: "admin", actorId: s.userId, note: `Return request ${r.returnRef ?? ""} sent to courier${reason ? `: ${reason}` : ""}` });
    revalidatePath(`/admin/orders/${id}`);
    return { ok: true, message: `Return request ${r.returnRef ?? "created"}` };
  } catch (e) {
    return fail(e);
  }
}

export async function resendConfirmationSmsAction(orderId: string): Promise<R> {
  try {
    await requireAdmin();
    const id = uuid.parse(orderId);
    const { data: o } = await createAdminClient().from("orders").select("order_number, total_bdt, customer_phone").eq("id", id).single();
    if (!o) return { ok: false, error: "Order not found" };
    await notifyConfirmed(id, o.order_number, o.total_bdt, o.customer_phone);
    revalidatePath(`/admin/orders/${id}`);
    return { ok: true, message: "SMS queued" };
  } catch (e) {
    return fail(e);
  }
}
