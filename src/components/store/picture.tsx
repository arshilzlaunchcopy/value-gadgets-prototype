/* eslint-disable @next/next/no-img-element --
   Pre-generated AVIF/WebP/JPEG variants (immutable, content-hashed) are served
   through <picture>; next/image would re-optimise per request (PART2 §16.1). */
import type { CSSProperties } from "react";
import type { PictureData } from "@/lib/media/picture";

export interface PictureProps {
  data: PictureData | null;
  sizes?: string;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
  /** shown when data is null */
  fallbackLabel?: string;
}

/** Client-safe <picture> renderer. No hooks, no zod. */
export function Picture({ data, sizes = "100vw", priority = false, className, imgClassName, fallbackLabel = "No image" }: PictureProps) {
  if (!data) {
    return (
      <div className={`bg-paper-line text-muted-foreground flex aspect-square items-center justify-center text-xs ${className ?? ""}`} aria-hidden="true">
        {fallbackLabel}
      </div>
    );
  }
  const style: CSSProperties | undefined = data.blur
    ? { backgroundImage: `url(${data.blur})`, backgroundSize: "cover", backgroundRepeat: "no-repeat" }
    : undefined;
  const img = (
    <img
      src={data.src}
      srcSet={data.webpSrcSet}
      sizes={data.webpSrcSet ? sizes : undefined}
      alt={data.alt}
      width={data.width}
      height={data.height}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
      className={imgClassName}
      style={style}
    />
  );
  if (!data.avifSrcSet && !data.webpSrcSet) return className ? <span className={className}>{img}</span> : img;
  // LCP image: a single WebP srcset so a <link rel=preload imagesrcset> matches exactly
  // what the browser will fetch (a <picture> with AVIF would double-download).
  if (priority) return className ? <span className={`block ${className}`}>{img}</span> : img;
  return (
    <picture className={className}>
      {data.avifSrcSet && <source type="image/avif" srcSet={data.avifSrcSet} sizes={sizes} />}
      {data.webpSrcSet && <source type="image/webp" srcSet={data.webpSrcSet} sizes={sizes} />}
      {img}
    </picture>
  );
}
