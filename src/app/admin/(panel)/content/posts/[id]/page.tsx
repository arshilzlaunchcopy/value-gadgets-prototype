import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { PostEditor } from "./post-editor";

export const dynamic = "force-dynamic";

export default async function PostEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "new";
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const admin = createAdminClient();
  const [{ data: p }, { data: products }] = await Promise.all([isNew ? Promise.resolve({ data: null }) : admin.from("posts").select("*").eq("id", id).maybeSingle(), admin.from("products").select("id, title_en").eq("status", "active").order("title_en").limit(500)]);
  if (!isNew && !p) notFound();
  return (
    <>
      <PageHeader title={p ? p.title_en : "New post"} description={p ? `/blog/${p.slug}` : "Buying guides and comparisons that rank. Link related products for the grid under the article."} />
      <PostEditor
        initial={p ? { id: p.id, slug: p.slug, title_en: p.title_en, excerpt_en: p.excerpt_en ?? "", content_en: p.content_en ?? "", title_bn: p.title_bn ?? "", excerpt_bn: p.excerpt_bn ?? "", content_bn: p.content_bn ?? "", cover_image_url: p.cover_image_url ?? "", cover_alt: p.cover_alt ?? "", author_name: p.author_name ?? "", reading_minutes: p.reading_minutes, status: p.status as "draft" | "published", related_product_ids: p.related_product_ids ?? [] } : null}
        products={(products ?? []).map((x) => ({ id: x.id, label: x.title_en }))}
      />
    </>
  );
}
