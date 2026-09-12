import type { ListFilters, SortKey } from "./queries";

export type SearchParams = Record<string, string | string[] | undefined>;

const SORTS: SortKey[] = ["relevance", "price_asc", "price_desc", "newest"];

/** Parse URL search params into typed, bounded list filters. */
export function parseListFilters(sp: SearchParams): ListFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) as string | undefined;
  const brandRaw = sp.brand;
  const brand = (Array.isArray(brandRaw) ? brandRaw : brandRaw ? brandRaw.split(",") : []).map((b) => b.trim()).filter(Boolean);
  const num = (k: string) => {
    const v = Number(one(k));
    return Number.isFinite(v) && v >= 0 ? Math.floor(v) : undefined;
  };
  const sort = one("sort");
  return {
    brand: brand.length ? brand : undefined,
    min: num("min"),
    max: num("max"),
    inStock: one("in_stock") === "1",
    sort: SORTS.includes(sort as SortKey) ? (sort as SortKey) : "relevance",
    page: Math.max(1, num("page") ?? 1),
  };
}

export function hasActiveFilters(f: ListFilters): boolean {
  return Boolean(f.brand?.length || f.min !== undefined || f.max !== undefined || f.inStock || (f.sort && f.sort !== "relevance"));
}

/** Rebuild a query string from filters, dropping defaults. */
export function filtersToQuery(f: ListFilters, overrides: Partial<ListFilters> = {}): string {
  const m = { ...f, ...overrides };
  const p = new URLSearchParams();
  if (m.brand?.length) p.set("brand", m.brand.join(","));
  if (m.min !== undefined) p.set("min", String(m.min));
  if (m.max !== undefined) p.set("max", String(m.max));
  if (m.inStock) p.set("in_stock", "1");
  if (m.sort && m.sort !== "relevance") p.set("sort", m.sort);
  if (m.page && m.page > 1) p.set("page", String(m.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}
