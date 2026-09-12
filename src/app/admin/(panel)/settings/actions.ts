"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/admin";
import { SETTINGS_REGISTRY, type SettingsKey } from "@/lib/settings-registry";
import { createAdminClient } from "@/lib/supabase/admin";

type R = { ok: boolean; error?: string; message?: string };
const fail = (e: unknown): R => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

/** Generic settings save: the key's zod schema validates, secrets stay non-public (BUILD_PROMPT §6.2). */
export async function saveSettingAction(keyRaw: string, raw: unknown): Promise<R> {
  try {
    const s = await requireAdmin("manager");
    const key = keyRaw as SettingsKey;
    const def = SETTINGS_REGISTRY[key];
    if (!def) return { ok: false, error: "Unknown settings key" };
    const value = def.schema.parse(raw);
    const admin = createAdminClient();
    const { data: before } = await admin.from("settings").select("value").eq("key", key).maybeSingle();
    const { error } = await admin.from("settings").upsert({ key, value: value as never, is_public: def.is_public, updated_by: s.userId }, { onConflict: "key" });
    if (error) return { ok: false, error: error.message };
    const redact = (v: unknown) => (key === "payments" ? { ...(v as object), sslcz_store_passwd: "***" } : v);
    await audit(s, `settings.${key}`, { type: "settings", before: redact(before?.value), after: redact(value) });
    revalidateTag("settings");
    revalidateTag("layout");
    revalidateTag("seo");
    revalidatePath("/", "layout");
    revalidatePath("/admin/settings");
    return { ok: true, message: `${def.label} saved` };
  } catch (e) {
    return fail(e);
  }
}

const zoneSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(60),
  districts: z.array(z.string().trim().min(1)).max(80),
  rate_bdt: z.number().int().min(0).max(100_000),
  free_above_bdt: z.number().int().min(0).nullable(),
  estimated_days: z.string().trim().max(40).optional().or(z.literal("")),
  is_active: z.boolean().default(true),
});

/** Shipping zones + their rate (BUILD_PROMPT §6.2 shipping zones and rates; PART2 §15.6 delivery zones). */
export async function saveShippingZoneAction(raw: unknown): Promise<R> {
  try {
    const s = await requireAdmin("manager");
    const z0 = zoneSchema.parse(raw);
    const admin = createAdminClient();
    let id = z0.id;
    if (id) {
      const { error } = await admin.from("shipping_zones").update({ name: z0.name, districts: z0.districts, is_active: z0.is_active }).eq("id", id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { data, error } = await admin.from("shipping_zones").insert({ name: z0.name, districts: z0.districts, is_active: z0.is_active }).select("id").single();
      if (error) return { ok: false, error: error.message };
      id = data.id;
    }
    const { data: rate } = await admin.from("shipping_rates").select("id").eq("zone_id", id).order("position").limit(1).maybeSingle();
    const rateRow = { zone_id: id, name: "Standard", rate_bdt: z0.rate_bdt, free_above_bdt: z0.free_above_bdt, estimated_days: z0.estimated_days || null, position: 0 };
    const { error: rErr } = rate ? await admin.from("shipping_rates").update(rateRow).eq("id", rate.id) : await admin.from("shipping_rates").insert(rateRow);
    if (rErr) return { ok: false, error: rErr.message };
    await audit(s, z0.id ? "shipping_zone.update" : "shipping_zone.create", { type: "shipping_zone", id, after: z0 });
    revalidateTag("catalog");
    revalidateTag("settings");
    revalidatePath("/admin/settings");
    return { ok: true, message: "Zone saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteShippingZoneAction(idRaw: string): Promise<R> {
  try {
    const s = await requireAdmin("manager");
    const id = z.string().uuid().parse(idRaw);
    const { error } = await createAdminClient().from("shipping_zones").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    await audit(s, "shipping_zone.delete", { type: "shipping_zone", id });
    revalidateTag("catalog");
    revalidatePath("/admin/settings");
    return { ok: true, message: "Zone deleted" };
  } catch (e) {
    return fail(e);
  }
}
