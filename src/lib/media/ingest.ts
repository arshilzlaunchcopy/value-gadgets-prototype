import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { processImage } from "./process";
import { getMediaStorage, type MediaStorage } from "./storage";
import { IMMUTABLE_CACHE_CONTROL, type ImageManifest, type ManifestEntry, type ProcessedImage } from "./types";

export interface UploadedImage {
  hash: string;
  width: number;
  height: number;
  blurDataUrl: string;
  manifest: ImageManifest;
  /** JPEG fallback URL - stored in product_images.url */
  url: string;
  bytes: number;
  reused: boolean;
}

/**
 * Process + upload every variant. Idempotent: if the JPEG fallback for this
 * content hash already exists in storage, the whole set is assumed present
 * (all variants are written together under the same hashed prefix).
 */
export async function processAndUpload(input: Buffer, storage: MediaStorage = getMediaStorage()): Promise<UploadedImage> {
  const processed = await processImage(input);
  const jpeg = processed.files.find((f) => f.format === "jpeg")!;
  const reused = await storage.exists(jpeg.key);

  if (!reused) {
    // Upload in small batches: R2/Supabase both handle ~4 concurrent PUTs fine.
    const batch = 4;
    for (let i = 0; i < processed.files.length; i += batch) {
      await Promise.all(
        processed.files
          .slice(i, i + batch)
          .map((f) => storage.put(f.key, f.body, f.contentType, IMMUTABLE_CACHE_CONTROL)),
      );
    }
  }

  const manifest = buildManifest(processed, storage);
  return {
    hash: processed.hash,
    width: processed.width,
    height: processed.height,
    blurDataUrl: processed.blurDataUrl,
    manifest,
    url: manifest.formats.jpeg.url,
    bytes: processed.files.reduce((n, f) => n + f.body.length, 0),
    reused,
  };
}

function buildManifest(p: ProcessedImage, storage: MediaStorage): ImageManifest {
  const entry = (f: ProcessedImage["files"][number]): ManifestEntry => ({
    w: f.w,
    h: f.h,
    url: storage.publicUrl(f.key),
    bytes: f.body.length,
  });
  const avif = p.files.filter((f) => f.format === "avif").map(entry);
  const webp = p.files.filter((f) => f.format === "webp").map(entry);
  const jpeg = entry(p.files.find((f) => f.format === "jpeg")!);
  return { version: 1, hash: p.hash, width: p.width, height: p.height, storage: storage.kind, formats: { avif, webp, jpeg } };
}

export interface IngestTarget {
  productId: string;
  variantId?: string | null;
  altTextEn: string;
  altTextBn?: string | null;
  position?: number;
}

/**
 * Full pipeline for a product image: process, upload, and upsert the
 * product_images row (keyed on product_id + content_hash so re-ingesting the
 * same file updates rather than duplicates).
 */
export async function ingestProductImage(input: Buffer, target: IngestTarget): Promise<{ imageId: string; image: UploadedImage }> {
  const image = await processAndUpload(input);
  const admin = createAdminClient();

  const row = {
    product_id: target.productId,
    variant_id: target.variantId ?? null,
    url: image.url,
    alt_text_en: target.altTextEn,
    alt_text_bn: target.altTextBn ?? null,
    width: image.width,
    height: image.height,
    position: target.position ?? 0,
    blur_data_url: image.blurDataUrl,
    manifest: image.manifest,
    content_hash: image.hash,
    format: "jpeg",
    bytes: image.bytes,
  };

  const { data: existing, error: findErr } = await admin
    .from("product_images")
    .select("id")
    .eq("product_id", target.productId)
    .eq("content_hash", image.hash)
    .maybeSingle();
  if (findErr) throw new Error(`product_images lookup failed: ${findErr.message}`);

  if (existing) {
    const { error } = await admin.from("product_images").update(row).eq("id", existing.id);
    if (error) throw new Error(`product_images update failed: ${error.message}`);
    return { imageId: existing.id, image };
  }
  const { data, error } = await admin.from("product_images").insert(row).select("id").single();
  if (error) throw new Error(`product_images insert failed: ${error.message}`);
  return { imageId: data.id, image };
}
