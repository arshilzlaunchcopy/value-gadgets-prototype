"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

/** Per-landing-page Meta Pixel event override (PART2 §15.2). No-op until the pixel is loaded. */
export function LandingPixel({ event, slug, variant }: { event: string | null; slug: string; variant: "a" | "b" }) {
  useEffect(() => {
    if (!event) return;
    try {
      window.fbq?.("trackCustom", event, { landing: slug, variant });
      window.gtag?.("event", event.toLowerCase(), { landing: slug, variant });
    } catch {}
  }, [event, slug, variant]);
  return null;
}
