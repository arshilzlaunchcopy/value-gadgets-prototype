import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** GET /api/admin/entities?type=product|category|collection|page&q= - id/label lists for pickers. */
export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sp = new URL(req.url).searchParams;
  const type = sp.get("type") ?? "product";
  const q = sp.get("q") ?? "";
  const admin = createAdminClient();
  let items: { id: string; label: string; slug: string }[] = [];
  if (type === "product") {
    let qb = admin.from("products").select("id, title_en, slug").order("title_en").limit(200);
    if (q) qb = qb.ilike("title_en", `%${q}%`);
    items = ((await qb).data ?? []).map((r) => ({ id: r.id, label: r.title_en, slug: r.slug }));
  } else if (type === "category") {
    items = ((await admin.from("categories").select("id, name_en, slug").order("position")).data ?? []).map((r) => ({ id: r.id, label: r.name_en, slug: r.slug }));
  } else if (type === "collection") {
    items = ((await admin.from("collections").select("id, title_en, slug").order("position")).data ?? []).map((r) => ({ id: r.id, label: r.title_en, slug: r.slug }));
  }
  return NextResponse.json({ items });
}
