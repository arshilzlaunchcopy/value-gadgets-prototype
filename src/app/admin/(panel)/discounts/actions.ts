"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/admin";
import { couponSchema } from "@/lib/discounts/schema";
import { createAdminClient } from "@/lib/supabase/admin";

type R<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };
const fail = (e: unknown): R<never> => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

export async function saveCouponAction(raw: unknown): Promise<R<{ id: string }>> {
  try {
    const s = await requireAdmin("manager");
    const c = couponSchema.parse(raw);
    if (c.type === "percentage" && c.value > 100) return { ok: false, error: "Percentage cannot exceed 100" };
    const admin = createAdminClient();
    const row = {
      code: c.code,
      description: c.description || null,
      type: c.type,
      value: c.type === "free_shipping" ? 0 : c.value,
      min_order_bdt: c.min_order_bdt,
      max_discount_bdt: c.max_discount_bdt ?? null,
      usage_limit: c.usage_limit ?? null,
      usage_limit_per_customer: c.usage_limit_per_customer,
      applies_to: (c.applies_all ? { all: true } : { all: false, category_ids: c.category_ids, product_ids: c.product_ids }) as never,
      starts_at: c.starts_at ? new Date(c.starts_at).toISOString() : null,
      ends_at: c.ends_at ? new Date(c.ends_at).toISOString() : null,
      is_active: c.is_active,
    };
    let id = c.id;
    let before: unknown = null;
    if (id) {
      before = (await admin.from("coupons").select("*").eq("id", id).maybeSingle()).data;
      const { error } = await admin.from("coupons").update(row).eq("id", id);
      if (error) return { ok: false, error: error.code === "23505" ? "That code is already used" : error.message };
    } else {
      const { data, error } = await admin.from("coupons").insert(row).select("id").single();
      if (error) return { ok: false, error: error.code === "23505" ? "That code is already used" : error.message };
      id = data.id;
    }
    await audit(s, id === c.id ? "coupon.update" : "coupon.create", { type: "coupon", id, before, after: row });
    revalidatePath("/admin/discounts");
    return { ok: true, data: { id: id! }, message: "Coupon saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCouponAction(idRaw: string): Promise<R> {
  try {
    const s = await requireAdmin("manager");
    const id = z.string().uuid().parse(idRaw);
    const admin = createAdminClient();
    const { data: before } = await admin.from("coupons").select("*").eq("id", id).maybeSingle();
    const { error } = await admin.from("coupons").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    await audit(s, "coupon.delete", { type: "coupon", id, before });
    revalidatePath("/admin/discounts");
    return { ok: true, message: "Deleted" };
  } catch (e) {
    return fail(e);
  }
}
