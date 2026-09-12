"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/admin";
import { LANDING_TAG } from "@/lib/landing/queries";
import { landingPageSchema } from "@/lib/landing/schema";
import { createAdminClient } from "@/lib/supabase/admin";

type R<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };
const fail = (e: unknown): R<never> => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

export async function saveLandingPageAction(raw: unknown): Promise<R<{ id: string; slug: string }>> {
  try {
    const s = await requireAdmin("manager");
    const p = landingPageSchema.parse(raw);
    const admin = createAdminClient();
    const row = {
      slug: p.slug,
      title: p.title,
      product_id: p.product_id || null,
      status: p.status,
      chrome: p.chrome,
      otp_mode: p.otp_mode,
      otp_threshold_bdt: p.otp_threshold_bdt,
      pixel_event: p.pixel_event || null,
      ab_enabled: p.ab_enabled,
      meta_title: p.meta_title || null,
      meta_description: p.meta_description || null,
      og_image_url: p.og_image_url || null,
      updated_by: s.userId,
      published_at: p.status === "published" ? new Date().toISOString() : null,
    };
    let id = p.id ?? null;
    let oldSlug: string | null = null;
    if (id) {
      const { data: prev } = await admin.from("landing_pages").select("slug, published_at").eq("id", id).maybeSingle();
      oldSlug = prev?.slug ?? null;
      const { error } = await admin.from("landing_pages").update({ ...row, published_at: p.status === "published" ? (prev?.published_at ?? row.published_at) : null }).eq("id", id);
      if (error) return { ok: false, error: error.code === "23505" ? "That slug is already used" : error.message };
    } else {
      const { data, error } = await admin.from("landing_pages").insert({ ...row, created_by: s.userId }).select("id").single();
      if (error) return { ok: false, error: error.code === "23505" ? "That slug is already used" : error.message };
      id = data.id;
    }
    if (oldSlug && oldSlug !== p.slug) {
      await admin.from("redirects").upsert({ from_path: `/lp/${oldSlug}`, to_path: `/lp/${p.slug}`, status_code: 301, is_active: true }, { onConflict: "from_path" });
      revalidatePath(`/lp/${oldSlug}`);
    }
    await audit(s, p.id ? "landing.update" : "landing.create", { type: "landing_page", id, after: { slug: p.slug, status: p.status, ab_enabled: p.ab_enabled } });
    revalidateTag(LANDING_TAG);
    revalidatePath(`/lp/${p.slug}`);
    revalidatePath("/admin/landing");
    return { ok: true, data: { id: id!, slug: p.slug }, message: "Landing page saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteLandingPageAction(idRaw: string): Promise<R> {
  try {
    await requireAdmin("manager");
    const id = z.string().uuid().parse(idRaw);
    const admin = createAdminClient();
    const { data: lp } = await admin.from("landing_pages").select("slug, variant_b_id").eq("id", id).maybeSingle();
    if (!lp) return { ok: false, error: "Not found" };
    await admin.from("content_blocks").delete().eq("page_type", "landing").in("target_id", [id, lp.variant_b_id]);
    await admin.from("content_drafts").delete().eq("page_type", "landing").in("target_id", [id, lp.variant_b_id]);
    const { error } = await admin.from("landing_pages").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidateTag(LANDING_TAG);
    revalidatePath(`/lp/${lp.slug}`);
    revalidatePath("/admin/landing");
    return { ok: true, message: "Deleted" };
  } catch (e) {
    return fail(e);
  }
}

/** Copy variant A's published blocks into variant B as a starting point for the test. */
export async function copyVariantAction(idRaw: string): Promise<R> {
  try {
    const s = await requireAdmin("manager");
    const id = z.string().uuid().parse(idRaw);
    const admin = createAdminClient();
    const { data: lp } = await admin.from("landing_pages").select("variant_b_id, slug").eq("id", id).single();
    const { data: rows } = await admin.from("content_blocks").select("block_type, settings, is_visible, visible_from, visible_until, locale, position").eq("page_type", "landing").eq("target_id", id).order("position");
    if (!lp || !rows?.length) return { ok: false, error: "Variant A has no published blocks yet" };
    const blocks = rows.map((r) => ({ block_type: r.block_type, settings: r.settings, is_visible: r.is_visible, visible_from: r.visible_from, visible_until: r.visible_until, locale: r.locale }));
    const { error } = await admin.rpc("publish_page", { p_page_type: "landing", p_target_id: lp.variant_b_id, p_blocks: blocks, p_label: "Copied from variant A", p_actor: s.userId } as never);
    if (error) return { ok: false, error: error.message };
    revalidateTag("content");
    revalidatePath(`/lp/${lp.slug}`);
    return { ok: true, message: "Variant B now mirrors A; edit it in the builder" };
  } catch (e) {
    return fail(e);
  }
}
