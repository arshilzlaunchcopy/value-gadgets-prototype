import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/store/breadcrumbs";
import { ProductListing } from "@/components/store/product-listing";
import { filtersToQuery, hasActiveFilters, parseListFilters, type SearchParams } from "@/lib/catalog/filters";
import { getCategoryBySlug, getCategoryProducts, getNavCategories } from "@/lib/catalog/queries";
import { staticParamsSafe } from "@/lib/build-safe";
import { publicEnv } from "@/lib/env.public";
import { itemListJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { getStoreSettings } from "@/lib/settings";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

export async function generateStaticParams() {
  return staticParamsSafe("categories", async () => (await getNavCategories()).map((c) => ({ slug: c.slug })));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp, store] = await Promise.all([params, searchParams, getStoreSettings()]);
  const cat = await getCategoryBySlug(slug);
  if (!cat) return {};
  const filters = parseListFilters(sp);
  const filteredCombo = hasActiveFilters(filters);
  const paged = (filters.page ?? 1) > 1;
  // §7.5: filtered combinations canonicalise to the base category unless the admin
  // marked this category's filters as worth indexing; plain pagination keeps its page.
  const canonicalQuery = filteredCombo ? (cat.index_filters ? filtersToQuery(filters) : "") : paged ? filtersToQuery({ page: filters.page }) : "";
  return buildMetadata({
    entityType: "category",
    entityId: cat.id,
    path: `/category/${cat.slug}${canonicalQuery}`,
    templateVars: { name: cat.name_en, title: cat.name_en },
    fallbackDescription: cat.description_en ?? `Shop ${cat.name_en.toLowerCase()} at ${store.name}. Genuine products, official warranty, cash on delivery across Bangladesh.`,
    image: cat.image_url ? { url: cat.image_url } : null,
    noindex: filteredCombo && !cat.index_filters,
  });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const cat = await getCategoryBySlug(slug);
  if (!cat) notFound();
  const filters = parseListFilters(sp);
  const list = await getCategoryProducts(cat.id, filters);
  const crumbs = [{ label: cat.name_en, href: `/category/${cat.slug}` }];

  return (
    <>
      <JsonLd data={[breadcrumbJsonLd(publicEnv.siteUrl, crumbs), itemListJsonLd(cat.name_en, `/category/${cat.slug}`, list.items)]} />
      <Breadcrumbs items={crumbs} />
      <header className="mb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">{cat.name_en}</h1>
        {cat.name_bn && (
          <p lang="bn" className="text-muted-foreground mt-1">
            {cat.name_bn}
          </p>
        )}
        {cat.description_en && <p className="text-muted-foreground mt-2 max-w-2xl text-sm">{cat.description_en}</p>}
      </header>
      <ProductListing basePath={`/category/${cat.slug}`} filters={filters} list={list} />
    </>
  );
}
