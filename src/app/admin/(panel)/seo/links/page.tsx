import { PageHeader } from "@/components/admin/page-header";
import { scanInternalLinks } from "@/lib/seo/audit";

export const dynamic = "force-dynamic";
export const metadata = { title: "Broken links" };

/** Broken internal link scanner (BUILD_PROMPT §7.10). Runs on every load; the data set is small. */
export default async function BrokenLinksPage() {
  const { checked, broken } = await scanInternalLinks();
  return (
    <>
      <PageHeader title="Broken internal link scanner" description={`${checked} internal link(s) checked across blocks, menus, pages and posts · ${broken.length} broken.`} />
      {broken.length === 0 ? (
        <p className="bg-paper text-success-deep rounded-2xl border p-8 text-center text-sm">No broken internal links.</p>
      ) : (
        <div className="bg-paper overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-paper-soft text-left text-xs uppercase"><tr><th className="px-3 py-2">Where</th><th className="px-3 py-2">Link</th><th className="px-3 py-2">Problem</th></tr></thead>
            <tbody>
              {broken.map((b, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2">{b.source}</td>
                  <td className="px-3 py-2 font-mono text-xs">{b.href}</td>
                  <td className="text-danger px-3 py-2 text-xs">{b.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
