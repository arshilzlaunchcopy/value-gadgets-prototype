import { googleMerchantXml, recordFeedRun } from "@/lib/seo/feeds";

export const revalidate = 3600;

/** /feeds/google-merchant.xml - Google Shopping RSS 2.0 (BUILD_PROMPT §7.7). Cached for an hour. */
export async function GET() {
  const xml = await googleMerchantXml();
  await recordFeedRun("google_merchant", (xml.match(/<item>/g) ?? []).length, Buffer.byteLength(xml)).catch(() => undefined);
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
