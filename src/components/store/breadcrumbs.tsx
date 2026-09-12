import Link from "next/link";
import { t, type Locale } from "@/lib/i18n/messages";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items, locale = "en" }: { items: Crumb[]; locale?: Locale }) {
  return (
    <nav aria-label="Breadcrumb" className="text-muted-foreground mb-4 text-xs sm:text-sm">
      <ol className="flex flex-wrap items-center gap-1">
        <li>
          <Link href="/" className="hover:text-foreground">
            {t(locale, "catalog.breadcrumb_home")}
          </Link>
        </li>
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1">
            <span aria-hidden="true">/</span>
            {c.href && i < items.length - 1 ? (
              <Link href={c.href} className="hover:text-foreground">
                {c.label}
              </Link>
            ) : (
              <span className="text-foreground" aria-current="page">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function breadcrumbJsonLd(siteUrl: string, items: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ label: "Home", href: "/" }, ...items].map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: new URL(c.href, siteUrl).toString() } : {}),
    })),
  };
}
