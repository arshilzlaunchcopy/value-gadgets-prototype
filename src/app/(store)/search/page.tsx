import type { Metadata } from "next";
import { ProductListing } from "@/components/store/product-listing";
import { parseListFilters, type SearchParams } from "@/lib/catalog/filters";
import { searchProducts } from "@/lib/catalog/queries";

type Props = { searchParams: Promise<SearchParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  return { title: q ? `Search: ${q}` : "Search", robots: { index: false, follow: true } };
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 80);
  const filters = parseListFilters(sp);
  const list = q ? await searchProducts(q, filters) : null;
  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">{q ? `Results for “${q}”` : "Search"}</h1>
        {list && <p className="text-muted-foreground mt-1 text-sm">{list.total} product{list.total === 1 ? "" : "s"}</p>}
      </header>
      {list ? (
        <ProductListing basePath="/search" filters={filters} list={list} extraQuery={`q=${encodeURIComponent(q)}`} />
      ) : (
        <p className="text-muted-foreground">Type something in the search box above.</p>
      )}
    </>
  );
}
