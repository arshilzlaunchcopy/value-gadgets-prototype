import { PageBuilder } from "@/components/admin/builder/page-builder";
import { loadBuilder } from "./builder-loader";

export const dynamic = "force-dynamic";

export default async function TemplateBuilderPage({ params }: { params: Promise<{ pageType: string }> }) {
  const { pageType } = await params;
  const initial = await loadBuilder(pageType, null);
  return <PageBuilder initial={initial} />;
}
