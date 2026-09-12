"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { LAYOUT_TAG } from "@/lib/theme/get";
import { THEME_SCHEMAS, type ThemeKey } from "@/lib/theme/schema";

export async function saveThemeAction(key: ThemeKey, values: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await requireAdmin("manager");
    const schema = THEME_SCHEMAS[key];
    if (!schema) return { ok: false, error: "Unknown theme key" };
    const parsed = schema.safeParse(values);
    if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
    const { error } = await createAdminClient().from("theme_settings").upsert({ key, value: parsed.data as never, updated_by: session.userId }, { onConflict: "key" });
    if (error) return { ok: false, error: error.message };
    // header/footer/theme changes invalidate every page (§13.8)
    revalidateTag(LAYOUT_TAG);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
