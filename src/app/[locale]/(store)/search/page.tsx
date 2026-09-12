import type { Metadata } from "next";
import { ProductListing } from "@/components/store/product-listing";
import { parseListFilters, type SearchParams } from "@/lib/catalog/filters";
import { searchProducts } from "@/lib/catalog/queries";
import { localeContext } from "@/lib/i18n/server";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  const L = await localeContext(locale);
  const q = typeof sp.q === "string" ? sp.q : "";
  return { title: q ? L.t("search.results_for", { q }) : L.t("search.title"), robots: { index: false, follow: true } };
}

export default async function SearchPage({ params, searchParams }: Props) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  const L = await localeContext(locale);
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 80);
  const filters = parseListFilters(sp);
  const list = q ? await searchProducts(q, filters) : null;
  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">{q ? L.t("search.results_for", { q }) : L.t("search.title")}</h1>
        {list && <p className="text-muted-foreground mt-1 text-sm">{L.t("search.count", { n: L.locale === "bn" ? L.money(list.total).replace("৳", "") : list.total })}</p>}
      </header>
      {list ? (
        <ProductListing basePath="/search" filters={filters} list={list} extraQuery={`q=${encodeURIComponent(q)}`} locale={L.locale} />
      ) : (
        <p className="text-muted-foreground">{L.t("search.hint")}</p>
      )}
    </>
  );
}
