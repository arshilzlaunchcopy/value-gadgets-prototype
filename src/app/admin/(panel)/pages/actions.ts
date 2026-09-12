"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { contentTag } from "@/lib/blocks/content";
import { PAGE_TYPES, type BlockRow, type PageType } from "@/lib/blocks/define";
import { parseSettings } from "@/lib/blocks/registry";
import { createAdminClient } from "@/lib/supabase/admin";

const pageTypeSchema = z.enum(PAGE_TYPES as [PageType, ...PageType[]]);
const targetSchema = z.string().uuid().nullable();
const rowSchema = z.object({
  id: z.string().min(1),
  block_type: z.string().min(1),
  settings: z.record(z.string(), z.unknown()),
  is_visible: z.boolean().default(true),
  visible_from: z.string().nullable().default(null),
  visible_until: z.string().nullable().default(null),
  locale: z.enum(["en", "bn"]).nullable().default(null),
});

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/** Validate every block against its schema (server-side, never trust the editor). */
function validateRows(rows: unknown): { ok: true; rows: BlockRow[] } | { ok: false; error: string } {
  const parsed = z.array(rowSchema).max(60).safeParse(rows);
  if (!parsed.success) return { ok: false, error: "Invalid block list" };
  const out: BlockRow[] = [];
  for (const r of parsed.data) {
    const s = parseSettings(r.block_type, r.settings);
    if (!s.ok) return { ok: false, error: `${r.block_type}: ${s.error}` };
    out.push({ ...r, settings: s.settings });
  }
  return { ok: true, rows: out };
}

async function revalidatePage(pageType: PageType, targetId: string | null) {
  revalidateTag(contentTag(pageType, targetId));
  revalidateTag("content");
  if (pageType === "home") revalidatePath("/");
  if (targetId) {
    const admin = createAdminClient();
    const table = pageType === "product" ? "products" : pageType === "category" ? "categories" : pageType === "collection" ? "collections" : null;
    if (table) {
      const { data } = await admin.from(table).select("slug").eq("id", targetId).maybeSingle();
      if (data?.slug) revalidatePath(`/${pageType === "product" ? "products" : pageType}/${data.slug}`);
    }
  }
}

export async function saveDraftAction(pageTypeRaw: string, targetIdRaw: string | null, rows: unknown): Promise<ActionResult<{ savedAt: string }>> {
  try {
    const session = await requireAdmin();
    const pageType = pageTypeSchema.parse(pageTypeRaw);
    const targetId = targetSchema.parse(targetIdRaw);
    const v = validateRows(rows);
    if (!v.ok) return { ok: false, error: v.error };
    const admin = createAdminClient();
    const { error } = await admin.from("content_drafts").upsert({ page_type: pageType, target_id: targetId, blocks: v.rows as never, updated_by: session.userId }, { onConflict: "page_type,target_id" });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { savedAt: new Date().toISOString() } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function publishPageAction(pageTypeRaw: string, targetIdRaw: string | null, rows: unknown, label?: string): Promise<ActionResult<{ count: number }>> {
  try {
    const session = await requireAdmin("manager");
    const pageType = pageTypeSchema.parse(pageTypeRaw);
    const targetId = targetSchema.parse(targetIdRaw);
    const v = validateRows(rows);
    if (!v.ok) return { ok: false, error: v.error };
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("publish_page", { p_page_type: pageType, p_target_id: targetId, p_blocks: v.rows, p_label: label?.trim() || null, p_actor: session.userId } as never);
    if (error) return { ok: false, error: error.message };
    await revalidatePage(pageType, targetId);
    return { ok: true, data: { count: Number(data ?? 0) } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function discardDraftAction(pageTypeRaw: string, targetIdRaw: string | null): Promise<ActionResult> {
  try {
    await requireAdmin();
    const pageType = pageTypeSchema.parse(pageTypeRaw);
    const targetId = targetSchema.parse(targetIdRaw);
    const admin = createAdminClient();
    let q = admin.from("content_drafts").delete().eq("page_type", pageType);
    q = targetId ? q.eq("target_id", targetId) : q.is("target_id", null);
    const { error } = await q;
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function saveRevisionAction(pageTypeRaw: string, targetIdRaw: string | null, rows: unknown, label: string): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    const pageType = pageTypeSchema.parse(pageTypeRaw);
    const targetId = targetSchema.parse(targetIdRaw);
    const v = validateRows(rows);
    if (!v.ok) return { ok: false, error: v.error };
    const admin = createAdminClient();
    const { error } = await admin.from("content_revisions").insert({ page_type: pageType, target_id: targetId, snapshot: v.rows as never, label: label.trim().slice(0, 80) || "Named save point", created_by: session.userId });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface RevisionSummary {
  id: string;
  label: string | null;
  created_at: string;
  created_by: string | null;
  block_count: number;
}

export async function listRevisionsAction(pageTypeRaw: string, targetIdRaw: string | null): Promise<ActionResult<RevisionSummary[]>> {
  try {
    await requireAdmin();
    const pageType = pageTypeSchema.parse(pageTypeRaw);
    const targetId = targetSchema.parse(targetIdRaw);
    const admin = createAdminClient();
    let q = admin.from("content_revisions").select("id, label, created_at, created_by, snapshot").eq("page_type", pageType).order("created_at", { ascending: false }).limit(30);
    q = targetId ? q.eq("target_id", targetId) : q.is("target_id", null);
    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []).map((r) => ({ id: r.id, label: r.label, created_at: r.created_at, created_by: r.created_by, block_count: Array.isArray(r.snapshot) ? r.snapshot.length : 0 })) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Loads a revision's snapshot into the editor (caller decides whether to save/publish). */
export async function getRevisionAction(idRaw: string): Promise<ActionResult<BlockRow[]>> {
  try {
    await requireAdmin();
    const id = z.string().uuid().parse(idRaw);
    const { data, error } = await createAdminClient().from("content_revisions").select("snapshot").eq("id", id).single();
    if (error) return { ok: false, error: error.message };
    const v = validateRows(data.snapshot);
    if (!v.ok) return { ok: false, error: v.error };
    return { ok: true, data: v.rows };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
