import { PageHeader } from "@/components/admin/page-header";
import { altTextReport } from "@/lib/seo/audit";
import { AltTextList } from "./alt-text-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Alt text report" };

export default async function AltTextPage() {
  const issues = await altTextReport();
  return (
    <>
      <PageHeader title="Missing alt-text report" description={`${issues.length} product image(s) with missing, too-short or generic alt text. Fix inline; the product page and image sitemaps update on save.`} />
      <AltTextList issues={issues} />
    </>
  );
}
