import { parseManifest } from "./types";

/**
 * Client-safe, pre-parsed picture data. Server components parse the manifest
 * (zod) once and pass this plain object to client components, so zod never
 * ships to the browser for image rendering.
 */
export interface PictureData {
  src: string;
  avifSrcSet?: string;
  webpSrcSet?: string;
  width?: number;
  height?: number;
  blur?: string;
  alt: string;
}

export interface ImageRowLike {
  url: string | null;
  alt_text_en?: string | null;
  manifest?: unknown;
  blur_data_url?: string | null;
  width?: number | null;
  height?: number | null;
}

export function toPicture(row: ImageRowLike | null | undefined, altFallback: string): PictureData | null {
  if (!row || !row.url) return null;
  const m = parseManifest(row.manifest);
  const set = (entries: { w: number; url: string }[]) => entries.map((e) => `${e.url} ${e.w}w`).join(", ");
  return {
    src: m?.formats.jpeg.url ?? row.url,
    avifSrcSet: m ? set(m.formats.avif) : undefined,
    webpSrcSet: m ? set(m.formats.webp) : undefined,
    width: m?.width ?? row.width ?? undefined,
    height: m?.height ?? row.height ?? undefined,
    blur: row.blur_data_url ?? undefined,
    alt: row.alt_text_en ?? altFallback,
  };
}
