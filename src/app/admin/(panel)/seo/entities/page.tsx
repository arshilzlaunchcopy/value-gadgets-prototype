import { PageHeader } from "@/components/admin/page-header";
import { listSeoEntities, type SeoEntityKind } from "@/lib/seo/audit";
import { EntitiesTable } from "./entities-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "SEO entities" };

const KINDS: SeoEntityKind[] = ["product", "category", "collection", "page", "post"];

export default async function SeoEntitiesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const kind = KINDS.includes(sp.kind as SeoEntityKind) ? (sp.kind as SeoEntityKind) : undefined;
  const rows = await listSeoEntities(kind);
  return (
    <>
      <PageHeader title="Indexable entities" description="Effective title and description per page, whether they are explicit or generated, and a completeness score. Edit inline; select products for a bulk template." />
      <EntitiesTable rows={rows} kind={kind ?? ""} />
    </>
  );
}
