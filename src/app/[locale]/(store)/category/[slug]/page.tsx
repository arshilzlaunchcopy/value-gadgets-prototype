import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/store/breadcrumbs";
import { ProductListing } from "@/components/store/product-listing";
import { staticParamsSafe } from "@/lib/build-safe";
import { filtersToQuery, hasActiveFilters, parseListFilters, type SearchParams } from "@/lib/catalog/filters";
import { getCategoryBySlug, getCategoryProducts, getNavCategories } from "@/lib/catalog/queries";
import { publicEnv } from "@/lib/env.public";
import { localeContext } from "@/lib/i18n/server";
import { itemListJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { getStoreSettings } from "@/lib/settings";

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<SearchParams> };

export async function generateStaticParams() {
  return staticParamsSafe("categories", async () => (await getNavCategories()).map((c) => ({ slug: c.slug })));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ locale, slug }, sp, store] = await Promise.all([params, searchParams, getStoreSettings()]);
  const cat = await getCategoryBySlug(slug);
  if (!cat) return {};
  const L = await localeContext(locale);
  const filters = parseListFilters(sp);
  const filteredCombo = hasActiveFilters(filters);
  const paged = (filters.page ?? 1) > 1;
  // §7.5: filtered combinations canonicalise to the base category unless the admin
  // marked this category's filters as worth indexing; plain pagination keeps its page.
  const canonicalQuery = filteredCombo ? (cat.index_filters ? filtersToQuery(filters) : "") : paged ? filtersToQuery({ page: filters.page }) : "";
  const name = L.pick(cat.name_en, cat.name_bn);
  return buildMetadata({
    entityType: "category",
    entityId: cat.id,
    locale: L.locale,
    path: `/category/${cat.slug}${canonicalQuery}`,
    templateVars: { name, title: name },
    fallbackDescription: cat.description_en ?? `Shop ${cat.name_en.toLowerCase()} at ${store.name}. Genuine products, official warranty, cash on delivery across Bangladesh.`,
    image: cat.image_url ? { url: cat.image_url } : null,
    noindex: filteredCombo && !cat.index_filters,
  });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ locale, slug }, sp] = await Promise.all([params, searchParams]);
  const cat = await getCategoryBySlug(slug);
  if (!cat) notFound();
  const L = await localeContext(locale);
  const filters = parseListFilters(sp);
  const list = await getCategoryProducts(cat.id, filters);
  const name = L.pick(cat.name_en, cat.name_bn);
  const crumbs = [{ label: name, href: `/category/${cat.slug}` }];

  return (
    <>
      <JsonLd data={[breadcrumbJsonLd(publicEnv.siteUrl, crumbs), itemListJsonLd(cat.name_en, `/category/${cat.slug}`, list.items)]} />
      <Breadcrumbs items={crumbs} locale={L.locale} />
      <header className="mb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">{name}</h1>
        {L.locale === "en" && cat.name_bn && (
          <p lang="bn" className="text-muted-foreground mt-1">
            {cat.name_bn}
          </p>
        )}
        {cat.description_en && <p className="text-muted-foreground mt-2 max-w-2xl text-sm">{cat.description_en}</p>}
      </header>
      <ProductListing basePath={`/category/${cat.slug}`} filters={filters} list={list} locale={L.locale} />
    </>
  );
}
