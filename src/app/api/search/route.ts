import { NextResponse } from "next/server";
import { quickSearch } from "@/lib/catalog/queries";

export const revalidate = 60;

/** GET /api/search?q= - instant search hits (tsvector, `simple` config). */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 80);
  const items = await quickSearch(q);
  return NextResponse.json(
    {
      items: items.map((p) => ({
        slug: p.slug,
        title_en: p.title_en,
        price_bdt: p.price_bdt,
        image: p.image ? { src: p.image.src, alt: p.image.alt } : null,
      })),
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
