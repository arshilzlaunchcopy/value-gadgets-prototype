import { sitemapIndexXml, XML_HEADERS } from "@/lib/seo/sitemaps";

export const revalidate = 3600;

/** Sitemap index (BUILD_PROMPT §7.4): points at the named sitemaps and their chunks. */
export async function GET() {
  return new Response(await sitemapIndexXml(), { headers: XML_HEADERS });
}
