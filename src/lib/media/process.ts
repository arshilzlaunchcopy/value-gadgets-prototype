import { createHash } from "node:crypto";
import sharp from "sharp";
import { IMAGE_WIDTHS, type GeneratedFile, type ProcessedImage } from "./types";

const JPEG_FALLBACK_WIDTH = 1280;

/**
 * Pre-generate every variant once at upload time (BUILD_PROMPT_PART2 §16.1):
 *   1. apply + strip EXIF (sharp drops metadata unless withMetadata is called)
 *   2. widths [320..1920], never upscaled
 *   3. AVIF + WebP per width, one JPEG fallback
 *   4. 20px LQIP as a base64 data URL
 *   5. content-hashed keys: images/<hash>/<w>.<ext>
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  // rotate() with no args applies the EXIF orientation; the output has no EXIF.
  const normalized = await sharp(input).rotate().toBuffer();
  const meta = await sharp(normalized).metadata();
  const srcW = meta.width ?? 0;
  const srcH = meta.height ?? 0;
  if (!srcW || !srcH) throw new Error("Could not read image dimensions");

  const hash = createHash("sha256").update(normalized).digest("hex").slice(0, 24);

  const widths = IMAGE_WIDTHS.filter((w) => w <= srcW) as number[];
  if (widths.length === 0 || (srcW < 1920 && !widths.includes(srcW))) widths.push(srcW);
  widths.sort((a, b) => a - b);

  const files: GeneratedFile[] = [];
  const heightFor = (w: number) => Math.max(1, Math.round((srcH * w) / srcW));

  for (const w of widths) {
    const base = () => sharp(normalized).resize({ width: w, withoutEnlargement: true });
    const [avif, webp] = await Promise.all([
      base().avif({ quality: 55, effort: 4 }).toBuffer(),
      base().webp({ quality: 80, effort: 4 }).toBuffer(),
    ]);
    files.push({ key: `images/${hash}/${w}.avif`, body: avif, contentType: "image/avif", format: "avif", w, h: heightFor(w) });
    files.push({ key: `images/${hash}/${w}.webp`, body: webp, contentType: "image/webp", format: "webp", w, h: heightFor(w) });
  }

  const jpegW = Math.min(JPEG_FALLBACK_WIDTH, srcW);
  const jpeg = await sharp(normalized)
    .resize({ width: jpegW, withoutEnlargement: true })
    .jpeg({ quality: 82, progressive: true, mozjpeg: true })
    .toBuffer();
  files.push({ key: `images/${hash}/${jpegW}.jpg`, body: jpeg, contentType: "image/jpeg", format: "jpeg", w: jpegW, h: heightFor(jpegW) });

  const lqip = await sharp(normalized).resize({ width: 20 }).webp({ quality: 40 }).toBuffer();
  const blurDataUrl = `data:image/webp;base64,${lqip.toString("base64")}`;

  return { hash, width: srcW, height: srcH, blurDataUrl, files };
}
