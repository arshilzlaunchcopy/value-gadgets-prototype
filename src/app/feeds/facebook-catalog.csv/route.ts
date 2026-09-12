import { facebookCatalogCsv, recordFeedRun } from "@/lib/seo/feeds";

export const revalidate = 3600;

/** /feeds/facebook-catalog.csv - Meta commerce catalog (BUILD_PROMPT §7.7). Cached for an hour. */
export async function GET() {
  const csv = await facebookCatalogCsv();
  await recordFeedRun("facebook_catalog", Math.max(0, csv.split("\n").length - 1), Buffer.byteLength(csv)).catch(() => undefined);
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'inline; filename="facebook-catalog.csv"', "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
