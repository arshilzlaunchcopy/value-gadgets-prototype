import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { processAndUpload } from "@/lib/media/ingest";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/admin/media?folder=&q=&limit= - media library listing (admins only). */
export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sp = new URL(req.url).searchParams;
  const admin = createAdminClient();
  let q = admin.from("media_assets").select("id, url, manifest, blur_data_url, width, height, bytes, alt_text, filename, folder, created_at").order("created_at", { ascending: false }).limit(Math.min(200, Number(sp.get("limit") ?? 60) || 60));
  if (sp.get("folder")) q = q.eq("folder", sp.get("folder")!);
  if (sp.get("q")) q = q.or(`filename.ilike.%${sp.get("q")}%,alt_text.ilike.%${sp.get("q")}%`);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

const meta = z.object({ alt_text: z.string().max(200).optional(), folder: z.string().max(40).regex(/^[a-z0-9-]*$/).optional() });

/** POST /api/admin/media (multipart: file, alt_text?, folder?) - runs the image pipeline, dedupes by content hash. */
export async function POST(req: Request) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  if (file.size > 12 * 1024 * 1024) return NextResponse.json({ error: "Max 12 MB" }, { status: 413 });
  const m = meta.safeParse({ alt_text: form.get("alt_text") ?? undefined, folder: form.get("folder") ?? undefined });
  if (!m.success) return NextResponse.json({ error: "Invalid fields" }, { status: 400 });

  try {
    const up = await processAndUpload(Buffer.from(await file.arrayBuffer()));
    const admin = createAdminClient();
    const row = { url: up.url, manifest: up.manifest as never, blur_data_url: up.blurDataUrl, width: up.width, height: up.height, bytes: up.bytes, alt_text: m.data.alt_text ?? file.name.replace(/\.[a-z0-9]+$/i, ""), filename: file.name, folder: m.data.folder || "general", content_hash: up.hash, created_by: session.userId };
    const { data, error } = await admin.from("media_assets").upsert(row, { onConflict: "content_hash" }).select("id, url, manifest, blur_data_url, width, height, bytes, alt_text, filename, folder, created_at").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, item: data, reused: up.reused });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
