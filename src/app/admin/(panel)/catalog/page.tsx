import { PageHeader } from "@/components/admin/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { CatalogEditor } from "./catalog-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Categories & collections" };

export default async function CatalogPage() {
  const admin = createAdminClient();
  const [{ data: categories }, { data: collections }, { data: pc }, { data: cp }] = await Promise.all([
    admin.from("categories").select("id, name_en, name_bn, slug, description_en, description_bn, parent_id, position, is_active, index_filters").order("position"),
    admin.from("collections").select("id, title_en, title_bn, slug, description_en, position, is_active, is_automatic").order("position"),
    admin.from("product_categories").select("category_id"),
    admin.from("collection_products").select("collection_id"),
  ]);
  const catCount = new Map<string, number>();
  for (const r of pc ?? []) catCount.set(r.category_id, (catCount.get(r.category_id) ?? 0) + 1);
  const colCount = new Map<string, number>();
  for (const r of cp ?? []) colCount.set(r.collection_id, (colCount.get(r.collection_id) ?? 0) + 1);
  return (
    <>
      <PageHeader title="Categories & collections" description="Names, slugs and descriptions. Changing a slug leaves a 301 behind. 'Index filters' lets filtered category URLs be indexed when the combinations have search volume (§7.5)." />
      <CatalogEditor
        categories={(categories ?? []).map((c) => ({ ...c, name_bn: c.name_bn ?? "", description_en: c.description_en ?? "", description_bn: c.description_bn ?? "", products: catCount.get(c.id) ?? 0 }))}
        collections={(collections ?? []).map((c) => ({ ...c, title_bn: c.title_bn ?? "", description_en: c.description_en ?? "", products: colCount.get(c.id) ?? 0 }))}
      />
    </>
  );
}
