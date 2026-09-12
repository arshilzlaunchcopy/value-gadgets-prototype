import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageEditor } from "./page-editor";

export const dynamic = "force-dynamic";

export default async function PageEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "new";
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: p } = isNew ? { data: null } : await createAdminClient().from("pages").select("*").eq("id", id).maybeSingle();
  if (!isNew && !p) notFound();
  return (
    <>
      <PageHeader title={p ? p.title_en : "New page"} description={p ? `/pages/${p.slug}` : "Markdown in English and Bangla. Placeholders: {store} {phone} {email} {address} {trade_license}."} />
      <PageEditor initial={p ? { id: p.id, slug: p.slug, title_en: p.title_en, title_bn: p.title_bn ?? "", content_en: p.content_en ?? "", content_bn: p.content_bn ?? "", is_published: p.is_published, show_in_footer: p.show_in_footer, position: p.position } : null} />
    </>
  );
}
