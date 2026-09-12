/* eslint-disable @next/next/no-img-element --
   Variants are pre-generated at upload time (AVIF + WebP + JPEG at fixed widths,
   content-hashed, immutable CDN cache). A <picture> with explicit srcSet is the
   only way to serve AVIF *and* WebP from that manifest; next/image would re-optimise
   per request, which is exactly what §16.1 tells us to avoid. */

import type { CSSProperties } from "react";
import { parseManifest, type ImageManifest } from "@/lib/media/types";

export interface ProductImageProps {
  /** product_images.manifest (jsonb) - may be null for legacy rows */
  manifest?: unknown;
  /** Fallback URL (product_images.url) when there is no manifest */
  src?: string | null;
  alt: string;
  /** product_images.blur_data_url */
  blurDataUrl?: string | null;
  width?: number | null;
  height?: number | null;
  /** e.g. "(min-width: 1024px) 50vw, 100vw". Defaults to full width. */
  sizes?: string;
  /** LCP image: eager + fetchPriority=high */
  priority?: boolean;
  className?: string;
  imgClassName?: string;
  style?: CSSProperties;
}

function srcSet(entries: { w: number; url: string }[]): string {
  return entries.map((e) => `${e.url} ${e.w}w`).join(", ");
}

/**
 * Server component. Emits <picture> with AVIF + WebP sources and a JPEG <img>,
 * explicit width/height (no CLS), a blur placeholder painted as background,
 * lazy by default, eager + high priority for the LCP image.
 */
export function ProductImage({
  manifest: rawManifest,
  src,
  alt,
  blurDataUrl,
  width,
  height,
  sizes = "100vw",
  priority = false,
  className,
  imgClassName,
  style,
}: ProductImageProps) {
  const manifest: ImageManifest | null = parseManifest(rawManifest);
  const w = manifest?.width ?? width ?? undefined;
  const h = manifest?.height ?? height ?? undefined;
  const fallback = manifest?.formats.jpeg.url ?? src ?? "";

  const imgStyle: CSSProperties = {
    ...(blurDataUrl
      ? { backgroundImage: `url(${blurDataUrl})`, backgroundSize: "cover", backgroundRepeat: "no-repeat" }
      : {}),
    ...style,
  };

  const img = (
    <img
      src={fallback}
      alt={alt}
      width={w}
      height={h}
      sizes={manifest ? sizes : undefined}
      srcSet={manifest ? srcSet(manifest.formats.webp) : undefined}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
      className={imgClassName}
      style={imgStyle}
    />
  );

  if (!manifest) return className ? <span className={className}>{img}</span> : img;

  return (
    <picture className={className}>
      <source type="image/avif" srcSet={srcSet(manifest.formats.avif)} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet(manifest.formats.webp)} sizes={sizes} />
      {img}
    </picture>
  );
}
