import { SITEMAP_NAMES, sitemapXml, XML_HEADERS, type SitemapName } from "@/lib/seo/sitemaps";

export const revalidate = 3600;

/** /sitemaps/{name}-{chunk}.xml - chunk 2+ of a named sitemap (5,000 URLs each). */
export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const m = /^([a-z]+)-(\d+)\.xml$/.exec(name);
  if (!m || !SITEMAP_NAMES.includes(m[1] as SitemapName)) return new Response("Not found", { status: 404 });
  const { xml, found } = await sitemapXml(m[1] as SitemapName, Number(m[2]));
  if (!found) return new Response("Not found", { status: 404 });
  return new Response(xml, { headers: XML_HEADERS });
}
