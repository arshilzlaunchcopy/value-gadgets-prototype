import { PageHeader } from "@/components/admin/page-header";
import { schemaToFields } from "@/lib/blocks/fields";
import { navItemSchema, type NavTreeNode } from "@/lib/navigation/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { NavigationEditor } from "./navigation-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Navigation" };

interface Row {
  id: string;
  menu_id: string;
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

function toNode(r: Row, children: NavTreeNode[]): NavTreeNode {
  const ml = (r.mega_layout ?? {}) as NavTreeNode["mega_layout"];
  return {
    id: r.id,
    label_en: r.label_en,
    label_bn: r.label_bn ?? "",
    link_type: r.link_type as NavTreeNode["link_type"],
    link_target: r.link_target ?? "",
    icon: r.icon ?? "",
    badge_label: r.badge_label ?? "",
    badge_color: r.badge_color ?? "",
    opens_new_tab: r.opens_new_tab,
    is_mega: r.is_mega,
    mega_layout: { columns: ml?.columns ?? [], featured: ml?.featured ?? { image_url: "", heading: "", href: "" } },
    children,
  };
}

export default async function NavigationPage() {
  const admin = createAdminClient();
  const [{ data: menus }, { data: items }] = await Promise.all([admin.from("navigation_menus").select("id, handle, title").order("handle"), admin.from("navigation_items").select("*").order("position")]);
  const rows = (items ?? []) as Row[];
  const trees = (menus ?? []).map((m) => {
    const mine = rows.filter((r) => r.menu_id === m.id);
    const top = mine.filter((r) => !r.parent_id).sort((a, b) => a.position - b.position);
    return { handle: m.handle, title: m.title, tree: top.map((t) => toNode(t, mine.filter((c) => c.parent_id === t.id).sort((a, b) => a.position - b.position).map((c) => toNode(c, [])))) };
  });
  return (
    <>
      <PageHeader title="Navigation" description="Main menu with mega-menu panels, the mobile menu and the footer columns. Drag to reorder; saving publishes immediately." />
      <NavigationEditor menus={trees} itemFields={schemaToFields(navItemSchema)} />
    </>
  );
}
