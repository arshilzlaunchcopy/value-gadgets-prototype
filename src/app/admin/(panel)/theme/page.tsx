import { PageHeader } from "@/components/admin/page-header";
import { schemaToFields } from "@/lib/blocks/fields";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseTheme, THEME_SCHEMAS, type ThemeKey } from "@/lib/theme/schema";
import { ThemeEditor } from "./theme-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Theme" };

const SECTIONS: { key: ThemeKey; label: string; description: string }[] = [
  { key: "announcement", label: "Announcement bar", description: "Campaign messaging above the header, with a schedule window." },
  { key: "header", label: "Header", description: "Logo, layout, sticky behaviour, utilities and the mobile tab bar." },
  { key: "footer", label: "Footer", description: "Link columns, about and contact blocks, trade licence, payment badges." },
  { key: "brand", label: "Brand", description: "Colours and number formatting." },
];

export default async function ThemePage() {
  const { data } = await createAdminClient().from("theme_settings").select("key, value");
  const theme = parseTheme(data ?? []);
  const sections = SECTIONS.map((s) => ({ ...s, fields: schemaToFields(THEME_SCHEMAS[s.key]), values: theme[s.key] as unknown as Record<string, unknown> }));
  return (
    <>
      <PageHeader title="Theme" description="Header, footer and announcement bar builders. Changes go live on save (every page revalidates)." />
      <ThemeEditor sections={sections} />
    </>
  );
}
