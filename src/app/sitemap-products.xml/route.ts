import { sitemapXml, XML_HEADERS } from "@/lib/seo/sitemaps";

export const revalidate = 3600;

/** /sitemap-products.xml (BUILD_PROMPT §7.4); further chunks live at /sitemaps/products-{n}.xml */
export async function GET() {
  const { xml } = await sitemapXml("products", 1);
  return new Response(xml, { headers: XML_HEADERS });
}
