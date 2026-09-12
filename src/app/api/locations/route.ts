import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

export const revalidate = 3600;

/**
 * GET /api/locations            -> divisions
 * GET /api/locations?parent=id  -> children (districts of a division, upazilas of a district)
 * GET /api/locations?level=district -> every district (quick order form)
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const parent = sp.get("parent");
  const level = sp.get("level");
  const supabase = createPublicClient();
  let q = supabase.from("bd_locations").select("id, level, name_en, name_bn, slug").order("position").order("name_en");
  q = parent ? q.eq("parent_id", parent) : q.eq("level", level === "district" ? "district" : "division");
  const { data } = await q;
  return NextResponse.json({ items: data ?? [] }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
