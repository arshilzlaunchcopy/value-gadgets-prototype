"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { navItemSchema, type NavTreeNode } from "@/lib/navigation/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { LAYOUT_TAG } from "@/lib/theme/get";

const nodeSchema: z.ZodType<NavTreeNode> = z.lazy(() => navItemSchema.extend({ id: z.string().min(1), children: z.array(nodeSchema).max(30).default([]) })) as z.ZodType<NavTreeNode>;

/** Replace a menu's items with the given two-level tree (positions from array order). */
export async function saveMenuTreeAction(handleRaw: string, treeRaw: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin("manager");
    const handle = z.string().regex(/^[a-z0-9_]{2,40}$/).parse(handleRaw);
    const tree = z.array(nodeSchema).max(40).parse(treeRaw);
    const admin = createAdminClient();
    const { data: menu, error: mErr } = await admin.from("navigation_menus").select("id").eq("handle", handle).maybeSingle();
    if (mErr) return { ok: false, error: mErr.message };
    if (!menu) return { ok: false, error: `Menu "${handle}" does not exist` };

    await admin.from("navigation_items").delete().eq("menu_id", menu.id);
    const row = (n: NavTreeNode, position: number, parent_id: string | null) => ({
      menu_id: menu.id,
      parent_id,
      label_en: n.label_en,
      label_bn: n.label_bn || null,
      link_type: n.link_type,
      link_target: n.link_target || null,
      icon: n.icon || null,
      badge_label: n.badge_label || null,
      badge_color: n.badge_color || null,
      is_mega: parent_id === null && n.is_mega,
      mega_layout: parent_id === null && n.is_mega ? (n.mega_layout as never) : null,
      position,
      opens_new_tab: n.opens_new_tab,
    });
    for (const [i, n] of tree.entries()) {
      const { data: inserted, error } = await admin.from("navigation_items").insert(row(n, i, null)).select("id").single();
      if (error) return { ok: false, error: error.message };
      if (n.children.length) {
        const { error: cErr } = await admin.from("navigation_items").insert(n.children.map((c, j) => row(c, j, inserted.id)));
        if (cErr) return { ok: false, error: cErr.message };
      }
    }
    revalidateTag(LAYOUT_TAG);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function createMenuAction(handleRaw: string, titleRaw: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin("manager");
    const handle = z.string().regex(/^[a-z0-9_]{2,40}$/, "lowercase letters, digits, underscores").parse(handleRaw);
    const title = z.string().trim().min(1).max(60).parse(titleRaw);
    const { error } = await createAdminClient().from("navigation_menus").upsert({ handle, title }, { onConflict: "handle" });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
