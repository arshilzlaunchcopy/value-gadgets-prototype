"use client";

import { usePathname } from "next/navigation";
import { localizePath, type Locale } from "@/lib/i18n/messages";

/**
 * EN / বাং toggle (PART2 §15.3). Plain links: /bn/... is a real URL and the
 * middleware stores the choice in the vg_locale cookie; /en/... redirects to
 * the unprefixed English URL and stores "en".
 */
export function LocaleSwitcher({ locale, className = "" }: { locale: Locale; className?: string }) {
  const pathname = usePathname() ?? "/";
  const to = (l: Locale) => (l === "en" ? `/en${localizePath(pathname, "en") === "/" ? "" : localizePath(pathname, "en")}` : localizePath(pathname, "bn"));
  return (
    <span className={`inline-flex items-center rounded-lg border border-current/30 text-xs ${className}`} aria-label="Language">
      <a href={to("en")} hrefLang="en" aria-current={locale === "en" ? "true" : undefined} className={`px-2 py-1 ${locale === "en" ? "bg-amber text-ink rounded-l-lg font-semibold" : "opacity-80 hover:opacity-100"}`}>
        EN
      </a>
      <a href={to("bn")} hrefLang="bn" lang="bn" aria-current={locale === "bn" ? "true" : undefined} className={`px-2 py-1 ${locale === "bn" ? "bg-amber text-ink rounded-r-lg font-semibold" : "opacity-80 hover:opacity-100"}`}>
        বাং
      </a>
    </span>
  );
}
