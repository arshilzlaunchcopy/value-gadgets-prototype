import { notFound } from "next/navigation";
import { PageBuilder } from "@/components/admin/builder/page-builder";
import { loadBuilder } from "../builder-loader";

export const dynamic = "force-dynamic";

export default async function InstanceBuilderPage({ params }: { params: Promise<{ pageType: string; targetId: string }> }) {
  const { pageType, targetId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(targetId)) notFound();
  const initial = await loadBuilder(pageType, targetId);
  return <PageBuilder initial={initial} />;
}
