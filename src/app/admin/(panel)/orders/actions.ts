"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
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

export async function markReviewedAction(orderId: string, approve: boolean): Promise<R> {
  try {
    const s = await requireAdmin();
    const id = uuid.parse(orderId);
    const admin = createAdminClient();
    await admin.from("orders").update({ needs_review: false }).eq("id", id);
    await appendOrderEvent(id, approve ? "review_approved" : "review_cancelled", { actorType: "admin", actorId: s.userId, note: approve ? "Approved from review queue" : "Cancelled from review queue" });
    if (!approve) await transitionOrder(id, "cancelled", { actorType: "admin", actorId: s.userId, note: "Fraud review: cancelled" });
    revalidatePath(`/admin/orders/${id}`);
    revalidatePath("/admin/orders");
    return { ok: true, message: approve ? "Approved" : "Cancelled" };
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
