import Link from "next/link";
import { filtersToQuery, hasActiveFilters } from "@/lib/catalog/filters";
import type { FacetBrand, ListFilters } from "@/lib/catalog/queries";

/**
 * URL-driven filters (BUILD_PROMPT §6.1): a plain GET form, so every filter
 * combination is a crawlable, shareable URL. No client JS.
 */
export function Filters({ basePath, filters, brands, priceRange, total }: { basePath: string; filters: ListFilters; brands: FacetBrand[]; priceRange: { min: number; max: number } | null; total: number }) {
  const active = hasActiveFilters(filters);
  return (
    <form method="get" action={basePath} className="bg-paper rounded-2xl border p-4 text-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-semibold">Filters</span>
        {active && (
          <Link href={basePath} className="text-muted-foreground text-xs underline">
            Clear all
          </Link>
        )}
      </div>

      <fieldset className="mb-4">
        <legend className="mb-2 font-medium">Sort</legend>
        <select name="sort" defaultValue={filters.sort ?? "relevance"} className="bg-paper w-full rounded-lg border px-2 py-1.5">
          <option value="relevance">Relevance</option>
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
      </fieldset>

      {brands.length > 1 && (
        <fieldset className="mb-4">
          <legend className="mb-2 font-medium">Brand</legend>
          <ul className="space-y-1">
            {brands.map((b) => (
              <li key={b.slug}>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="brand" value={b.slug} defaultChecked={filters.brand?.includes(b.slug)} className="accent-amber size-4" />
                  <span>{b.name}</span>
                  <span className="text-muted-foreground ml-auto text-xs tabular-nums">{b.count}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <fieldset className="mb-4">
        <legend className="mb-2 font-medium">Price (৳)</legend>
        <div className="flex items-center gap-2">
          <input type="number" name="min" inputMode="numeric" min={0} placeholder={priceRange ? String(priceRange.min) : "Min"} defaultValue={filters.min ?? ""} className="bg-paper w-full rounded-lg border px-2 py-1.5" aria-label="Minimum price" />
          <span className="text-muted-foreground">to</span>
          <input type="number" name="max" inputMode="numeric" min={0} placeholder={priceRange ? String(priceRange.max) : "Max"} defaultValue={filters.max ?? ""} className="bg-paper w-full rounded-lg border px-2 py-1.5" aria-label="Maximum price" />
        </div>
      </fieldset>

      <label className="mb-4 flex items-center gap-2">
        <input type="checkbox" name="in_stock" value="1" defaultChecked={filters.inStock} className="accent-amber size-4" />
        In stock only
      </label>

      <button type="submit" className="bg-ink text-paper hover:bg-ink-soft w-full rounded-2xl px-4 py-2 font-medium">
        Apply
      </button>
      <p className="text-muted-foreground mt-3 text-xs">{total} product{total === 1 ? "" : "s"}</p>
      <noscript>
        <p className="text-muted-foreground mt-2 text-xs">Filters work without JavaScript.</p>
      </noscript>
      {/* keep the current page out of the form so a new filter starts on page 1 */}
      <input type="hidden" name="page" value="" />
      {active && <input type="hidden" name="_q" value={filtersToQuery(filters, { page: 1 })} />}
    </form>
  );
}
