import { z } from "zod";

/** Output widths generated at upload time (BUILD_PROMPT_PART2 §16.1). Never upscaled. */
export const IMAGE_WIDTHS = [320, 480, 640, 960, 1280, 1920] as const;

/** Cache-Control for every generated object: content-hashed paths make this safe. */
export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

export const manifestEntrySchema = z.object({
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  url: z.string().min(1),
  bytes: z.number().int().nonnegative(),
});

export const imageManifestSchema = z.object({
  version: z.literal(1),
  hash: z.string().min(8),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  storage: z.enum(["r2", "supabase"]),
  formats: z.object({
    avif: z.array(manifestEntrySchema).min(1),
    webp: z.array(manifestEntrySchema).min(1),
    jpeg: manifestEntrySchema,
  }),
});

export type ManifestEntry = z.infer<typeof manifestEntrySchema>;
export type ImageManifest = z.infer<typeof imageManifestSchema>;

export type ImageFormat = "avif" | "webp" | "jpeg";

export interface GeneratedFile {
  key: string;
  body: Buffer;
  contentType: string;
  format: ImageFormat;
  w: number;
  h: number;
}

export interface ProcessedImage {
  hash: string;
  width: number;
  height: number;
  blurDataUrl: string;
  files: GeneratedFile[];
}

export function parseManifest(value: unknown): ImageManifest | null {
  const r = imageManifestSchema.safeParse(value);
  return r.success ? r.data : null;
}
