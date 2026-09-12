import { filtersToQuery } from "@/lib/catalog/filters";
import type { ListFilters, ProductList } from "@/lib/catalog/queries";
import { tFor, type Locale } from "@/lib/i18n/messages";
import { Filters } from "./filters";
import { Pagination } from "./pagination";
import { ProductGrid } from "./product-grid";

/** Shared category / collection / search listing: filters rail + grid + pagination. */
export function ProductListing({ basePath, filters, list, extraQuery = "", locale = "en" }: { basePath: string; filters: ListFilters; list: ProductList; extraQuery?: string; locale?: Locale }) {
  const t = tFor(locale);
  const hrefFor = (page: number) => {
    const q = filtersToQuery(filters, { page });
    if (!extraQuery) return `${basePath}${q}`;
    return `${basePath}?${extraQuery}${q ? `&${q.slice(1)}` : ""}`;
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside>
        <details className="lg:hidden" open={false}>
          <summary className="bg-paper cursor-pointer rounded-2xl border px-4 py-2 text-sm font-medium">{t("catalog.filters")} &amp; {t("catalog.sort").toLowerCase()}</summary>
          <div className="mt-2">
            <Filters basePath={basePath} filters={filters} brands={list.brands} priceRange={list.priceRange} total={list.total} locale={locale} />
          </div>
        </details>
        <div className="hidden lg:block">
          <Filters basePath={basePath} filters={filters} brands={list.brands} priceRange={list.priceRange} total={list.total} locale={locale} />
        </div>
      </aside>
      <div>
        <ProductGrid products={list.items} eager={4} emptyMessage={t("catalog.no_products")} locale={locale} />
        <Pagination page={list.page} pageCount={list.pageCount} hrefFor={hrefFor} locale={locale} />
      </div>
    </div>
  );
}
