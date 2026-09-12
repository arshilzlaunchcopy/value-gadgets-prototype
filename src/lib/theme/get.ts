import "server-only";

import { unstable_cache } from "next/cache";
import { resolveHref } from "@/lib/navigation/resolve";
import { createPublicClient } from "@/lib/supabase/public";
import { parseTheme, type Theme } from "./schema";

export const LAYOUT_TAG = "layout";

export const getTheme = unstable_cache(
  async (): Promise<Theme> => {
    const { data } = await createPublicClient().from("theme_settings").select("key, value");
    return parseTheme(data ?? []);
  },
  ["theme"],
  { revalidate: 3600, tags: [LAYOUT_TAG] },
);

export interface MenuLink {
  label: string;
  href: string;
}
export interface MegaColumn {
  heading: string;
  links: MenuLink[];
}
export interface NavItem {
  id: string;
  label_en: string;
  label_bn: string | null;
  href: string;
  icon: string | null;
  badge_label: string | null;
  badge_color: string | null;
  opens_new_tab: boolean;
  is_mega: boolean;
  mega: { columns: MegaColumn[]; featured: { image_url: string; heading: string; href: string } | null } | null;
  children: NavItem[];
}

interface Row {
  id: string;
  parent_id: string | null;
  label_en: string;
  label_bn: string | null;
  link_type: string;
  link_target: string | null;
  icon: string | null;
  badge_label: string | null;
  badge_color: string | null;
  is_mega: boolean;
  mega_layout: unknown;
  position: number;
  opens_new_tab: boolean;
}

function toTree(rows: Row[]): NavItem[] {
  const byParent = new Map<string | null, Row[]>();
  for (const r of rows) {
    const list = byParent.get(r.parent_id) ?? [];
    list.push(r);
    byParent.set(r.parent_id, list);
  }
  const build = (parent: string | null): NavItem[] =>
    (byParent.get(parent) ?? [])
      .sort((a, b) => a.position - b.position)
      .map((r) => {
        const ml = (r.mega_layout ?? null) as { columns?: { heading?: string; links?: { label?: string; link_type?: string; link_target?: string }[] }[]; featured?: { image_url?: string; heading?: string; href?: string } } | null;
        const mega = r.is_mega && ml
          ? {
              columns: (ml.columns ?? []).map((c) => ({ heading: c.heading ?? "", links: (c.links ?? []).filter((l) => l.label).map((l) => ({ label: l.label!, href: resolveHref(l.link_type ?? "url", l.link_target) })) })),
              featured: ml.featured?.image_url || ml.featured?.heading ? { image_url: ml.featured.image_url ?? "", heading: ml.featured.heading ?? "", href: ml.featured.href ?? "/" } : null,
            }
          : null;
        return { id: r.id, label_en: r.label_en, label_bn: r.label_bn, href: resolveHref(r.link_type, r.link_target), icon: r.icon, badge_label: r.badge_label, badge_color: r.badge_color, opens_new_tab: r.opens_new_tab, is_mega: r.is_mega, mega, children: build(r.id) };
      });
  return build(null);
}

/** All menus keyed by handle, resolved to hrefs. One query, cached under the layout tag. */
export const getMenus = unstable_cache(
  async (): Promise<Record<string, NavItem[]>> => {
    const supabase = createPublicClient();
    const [{ data: menus }, { data: items }] = await Promise.all([supabase.from("navigation_menus").select("id, handle"), supabase.from("navigation_items").select("id, menu_id, parent_id, label_en, label_bn, link_type, link_target, icon, badge_label, badge_color, is_mega, mega_layout, position, opens_new_tab")]);
    const out: Record<string, NavItem[]> = {};
    for (const m of menus ?? []) out[m.handle] = toTree(((items ?? []) as (Row & { menu_id: string })[]).filter((i) => i.menu_id === m.id));
    return out;
  },
  ["menus"],
  { revalidate: 3600, tags: [LAYOUT_TAG] },
);
