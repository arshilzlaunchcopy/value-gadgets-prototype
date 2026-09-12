import Link from "next/link";
import { tFor, type Locale } from "@/lib/i18n/messages";

export function Pagination({ page, pageCount, hrefFor, locale = "en" }: { page: number; pageCount: number; hrefFor: (p: number) => string; locale?: Locale }) {
  const t = tFor(locale);
  if (pageCount <= 1) return null;
  const pages = [...new Set([1, page - 1, page, page + 1, pageCount].filter((p) => p >= 1 && p <= pageCount))].sort((a, b) => a - b);
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-1">
      {page > 1 && (
        <Link rel="prev" href={hrefFor(page - 1)} className="hover:bg-accent rounded-lg border px-3 py-1.5 text-sm">
          {t("catalog.prev")}
        </Link>
      )}
      {pages.map((p, i) => (
        <span key={p} className="contents">
          {i > 0 && pages[i - 1] !== p - 1 && <span className="text-muted-foreground px-1">…</span>}
          <Link href={hrefFor(p)} aria-current={p === page ? "page" : undefined} className={`rounded-lg border px-3 py-1.5 text-sm tabular-nums ${p === page ? "bg-ink text-paper border-ink" : "hover:bg-accent"}`}>
            {p}
          </Link>
        </span>
      ))}
      {page < pageCount && (
        <Link rel="next" href={hrefFor(page + 1)} className="hover:bg-accent rounded-lg border px-3 py-1.5 text-sm">
          {t("catalog.next")}
        </Link>
      )}
    </nav>
  );
}
