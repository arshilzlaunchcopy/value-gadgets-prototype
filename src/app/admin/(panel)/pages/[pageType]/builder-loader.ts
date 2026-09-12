import "server-only";

import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/admin";
import { PAGE_TYPES, type BlockRow, type PageType } from "@/lib/blocks/define";
import { listBlocks, type BlockMeta } from "@/lib/blocks/registry";
import { signPreview } from "@/lib/preview";
import { createAdminClient } from "@/lib/supabase/admin";

export interface BuilderInitial {
  pageType: PageType;
  targetId: string | null;
  targetLabel: string | null;
  blocks: BlockRow[];
  hasDraft: boolean;
  draftUpdatedAt: string | null;
  publishedCount: number;
  blockMetas: BlockMeta[];
  previewUrl: string;
}

const rowCols = "id, block_type, settings, is_visible, visible_from, visible_until, locale, position";

export async function loadBuilder(pageTypeRaw: string, targetId: string | null): Promise<BuilderInitial> {
  if (!PAGE_TYPES.includes(pageTypeRaw as PageType)) notFound();
  const pageType = pageTypeRaw as PageType;
  const session = await requireAdminPage("/admin/pages");
  const admin = createAdminClient();

  let dq = admin.from("content_drafts").select("blocks, updated_at").eq("page_type", pageType);
  dq = targetId ? dq.eq("target_id", targetId) : dq.is("target_id", null);
  let lq = admin.from("content_blocks").select(rowCols).eq("page_type", pageType).eq("scope", targetId ? "instance" : "template").order("position");
  lq = targetId ? lq.eq("target_id", targetId) : lq.is("target_id", null);
  const [{ data: draft }, { data: live }] = await Promise.all([dq.maybeSingle(), lq]);

  const liveRows: BlockRow[] = (live ?? []).map((r) => ({ id: r.id, block_type: r.block_type, settings: (r.settings ?? {}) as Record<string, unknown>, is_visible: r.is_visible, visible_from: r.visible_from, visible_until: r.visible_until, locale: (r.locale as BlockRow["locale"]) ?? null }));
  const draftRows = Array.isArray(draft?.blocks) ? (draft!.blocks as unknown as BlockRow[]) : null;

  let targetLabel: string | null = null;
  if (targetId) {
    const table = pageType === "product" ? "products" : pageType === "category" ? "categories" : pageType === "collection" ? "collections" : null;
    if (table) {
      const { data } = await admin.from(table).select("*").eq("id", targetId).maybeSingle();
      const row = data as { title_en?: string; name_en?: string } | null;
      targetLabel = row?.title_en ?? row?.name_en ?? targetId;
    } else if (pageType === "landing") {
      const { data } = await admin.from("landing_pages").select("title, slug, variant_b_id").or(`id.eq.${targetId},variant_b_id.eq.${targetId}`).maybeSingle();
      if (data) targetLabel = `${data.title} (/lp/${data.slug}) · variant ${data.variant_b_id === targetId ? "B" : "A"}`;
    }
  }

  const token = signPreview(pageType, targetId);
  const previewUrl = `/preview/${pageType}${targetId ? `/${targetId}` : ""}?token=${encodeURIComponent(token)}`;

  return {
    pageType,
    targetId,
    targetLabel,
    blocks: draftRows ?? liveRows,
    hasDraft: Boolean(draftRows),
    draftUpdatedAt: draft?.updated_at ?? null,
    publishedCount: liveRows.length,
    blockMetas: listBlocks(pageType, session.role),
    previewUrl,
  };
}
