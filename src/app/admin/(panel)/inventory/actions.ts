"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const STOCK_REASONS = ["received", "correction", "damaged", "return", "sample", "other"] as const;

export async function adjustStockAction(lines: { variant_id: string; delta: number }[], reason: string, note?: string): Promise<{ ok: boolean; error?: string; message?: string }> {
  try {
    const s = await requireAdmin();
    const parsed = z.array(z.object({ variant_id: z.string().uuid(), delta: z.number().int().min(-10000).max(10000) })).min(1).max(50).parse(lines);
    const r = z.enum(STOCK_REASONS).parse(reason);
    const admin = createAdminClient();
    let n = 0;
    for (const l of parsed) {
      if (l.delta === 0) continue;
      const { error } = await admin.rpc("adjust_stock", { p_variant: l.variant_id, p_delta: l.delta, p_reason: r, p_actor: s.userId, p_note: note?.trim() || undefined });
      if (error) return { ok: false, error: error.message };
      n++;
    }
    revalidateTag("catalog");
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/products");
    return { ok: true, message: `${n} adjustment(s) recorded` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
