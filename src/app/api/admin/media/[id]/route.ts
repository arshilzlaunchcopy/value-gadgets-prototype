import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const patch = z.object({ alt_text: z.string().max(200).optional(), folder: z.string().max(40).regex(/^[a-z0-9-]*$/).optional() });

/** PATCH /api/admin/media/{id} - alt text / folder. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = patch.safeParse(await req.json().catch(() => null));
  if (!body.success || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const { data, error } = await createAdminClient().from("media_assets").update({ ...(body.data.alt_text !== undefined ? { alt_text: body.data.alt_text } : {}), ...(body.data.folder ? { folder: body.data.folder } : {}) }).eq("id", id).select("id, alt_text, folder").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await audit(session, "media.update", { type: "media_asset", id, after: body.data });
  return NextResponse.json({ ok: true, item: data });
}

/** DELETE /api/admin/media/{id} - removes the library row (files stay on storage; the CDN URL may still be referenced). */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireAdmin("manager");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const admin = createAdminClient();
  const { data: before } = await admin.from("media_assets").select("url, filename").eq("id", id).maybeSingle();
  const { error } = await admin.from("media_assets").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await audit(session, "media.delete", { type: "media_asset", id, before });
  return NextResponse.json({ ok: true });
}
