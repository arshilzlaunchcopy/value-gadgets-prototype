import "server-only";

import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { BlockRow, PageType } from "./define";

export const CONTENT_REVALIDATE = 3600;

export function contentTag(pageType: PageType, targetId: string | null): string {
  return `content:${pageType}:${targetId ?? "template"}`;
}

type Row = { id: string; block_type: string; settings: unknown; is_visible: boolean; visible_from: string | null; visible_until: string | null; locale: string | null; position: number };

function toRows(data: Row[] | null): BlockRow[] {
  return (data ?? [])
    .sort((a, b) => a.position - b.position)
    .map((r) => ({ id: r.id, block_type: r.block_type, settings: (r.settings ?? {}) as Record<string, unknown>, is_visible: r.is_visible, visible_from: r.visible_from, visible_until: r.visible_until, locale: (r.locale as BlockRow["locale"]) ?? null }));
}

/** Published blocks for one page: instance override, else the page-type template (§13.6). */
export const getPublishedBlocks = unstable_cache(
  async (pageType: PageType, targetId: string | null): Promise<{ blocks: BlockRow[]; source: "instance" | "template" | "none" }> => {
    const supabase = createPublicClient();
    const cols = "id, block_type, settings, is_visible, visible_from, visible_until, locale, position";
    if (targetId) {
      const { data } = await supabase.from("content_blocks").select(cols).eq("page_type", pageType).eq("scope", "instance").eq("target_id", targetId).order("position");
      if (data?.length) return { blocks: toRows(data as Row[]), source: "instance" };
    }
    const { data } = await supabase.from("content_blocks").select(cols).eq("page_type", pageType).eq("scope", "template").is("target_id", null).order("position");
    return { blocks: toRows(data as Row[]), source: data?.length ? "template" : "none" };
  },
  ["published-blocks"],
  { revalidate: CONTENT_REVALIDATE, tags: ["content"] },
);

/** Schedule + locale filter, applied at render time (not cached, so windows are exact). */
export function visibleNow(rows: BlockRow[], locale: "en" | "bn", now = new Date()): BlockRow[] {
  return rows.filter((b) => {
    if (!b.is_visible) return false;
    if (b.locale && b.locale !== locale) return false;
    if (b.visible_from && new Date(b.visible_from) > now) return false;
    if (b.visible_until && new Date(b.visible_until) < now) return false;
    return true;
  });
}
