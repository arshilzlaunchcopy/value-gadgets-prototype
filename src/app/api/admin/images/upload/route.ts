import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrSeedToken } from "@/lib/auth/guards";
import { ingestProductImage } from "@/lib/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 12 * 1024 * 1024;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/tiff"]);

const fieldsSchema = z.object({
  product_id: z.string().uuid(),
  variant_id: z.string().uuid().optional(),
  alt_text_en: z.string().min(1).max(200),
  alt_text_bn: z.string().max(200).optional(),
  position: z.coerce.number().int().min(0).default(0),
});

/**
 * POST /api/admin/images/upload  (multipart/form-data)
 *   file, product_id, alt_text_en, [alt_text_bn], [variant_id], [position]
 *
 * Runs the full pipeline: EXIF strip, AVIF/WebP at 6 widths + JPEG fallback,
 * LQIP, content-hashed upload (R2 or Supabase Storage), product_images upsert.
 */
export async function POST(req: Request) {
  const authz = await requireAdminOrSeedToken(req);
  if (!authz.ok) return authz.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: `File must be 1 byte to ${MAX_BYTES / 1024 / 1024} MB` }, { status: 413 });
  }
  if (file.type && !ACCEPTED.has(file.type)) {
    return NextResponse.json({ error: `Unsupported type ${file.type}` }, { status: 415 });
  }

  const fields = fieldsSchema.safeParse({
    product_id: form.get("product_id") ?? undefined,
    variant_id: form.get("variant_id") ?? undefined,
    alt_text_en: form.get("alt_text_en") ?? undefined,
    alt_text_bn: form.get("alt_text_bn") ?? undefined,
    position: form.get("position") ?? undefined,
  });
  if (!fields.success) {
    return NextResponse.json({ error: "Invalid fields", issues: fields.error.flatten() }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { imageId, image } = await ingestProductImage(buffer, {
      productId: fields.data.product_id,
      variantId: fields.data.variant_id ?? null,
      altTextEn: fields.data.alt_text_en,
      altTextBn: fields.data.alt_text_bn ?? null,
      position: fields.data.position,
    });
    return NextResponse.json({
      ok: true,
      image_id: imageId,
      url: image.url,
      width: image.width,
      height: image.height,
      hash: image.hash,
      reused: image.reused,
      storage: image.manifest.storage,
      variants: image.manifest.formats.avif.length + image.manifest.formats.webp.length + 1,
      blur_data_url: image.blurDataUrl,
      manifest: image.manifest,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[images/upload]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
