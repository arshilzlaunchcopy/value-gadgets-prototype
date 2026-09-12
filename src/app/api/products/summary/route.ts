import { NextResponse } from "next/server";
import { getProductsForSource } from "@/lib/catalog/queries";

export const revalidate = 600;

/** GET /api/products/summary?slugs=a,b,c - public product cards for client islands (recently viewed). */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("slugs") ?? "";
  const slugs = [...new Set(raw.split(",").map((s) => s.trim()).filter((s) => /^[a-z0-9-]{1,120}$/.test(s)))].slice(0, 24);
  if (slugs.length === 0) return NextResponse.json({ items: [] });
  const items = await getProductsForSource({ source: "manual", slugs, limit: 24 });
  return NextResponse.json({ items }, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
}
