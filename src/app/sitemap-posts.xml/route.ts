import { sitemapXml, XML_HEADERS } from "@/lib/seo/sitemaps";

export const revalidate = 3600;

/** /sitemap-posts.xml (BUILD_PROMPT §7.4); further chunks live at /sitemaps/posts-{n}.xml */
export async function GET() {
  const { xml } = await sitemapXml("posts", 1);
  return new Response(xml, { headers: XML_HEADERS });
}
