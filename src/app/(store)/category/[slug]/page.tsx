import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/store/breadcrumbs";
import { ProductListing } from "@/components/store/product-listing";
import { filtersToQuery, hasActiveFilters, parseListFilters, type SearchParams } from "@/lib/catalog/filters";
import { getCategoryBySlug, getCategoryProducts, getNavCategories } from "@/lib/catalog/queries";
import { publicEnv } from "@/lib/env.public";
import { getStoreSettings } from "@/lib/settings";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

export async function generateStaticParams() {
  return (await getNavCategories()).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp, store] = await Promise.all([params, searchParams, getStoreSettings()]);
  const cat = await getCategoryBySlug(slug);
  if (!cat) return {};
  const filters = parseListFilters(sp);
  const filtered = hasActiveFilters(filters) || (filters.page ?? 1) > 1;
  return {
    title: `${cat.name_en} - Buy Online in Bangladesh`,
    description: cat.description_en ?? `Shop ${cat.name_en.toLowerCase()} at ${store.name}. Genuine products, official warranty, cash on delivery across Bangladesh.`,
    // filtered combinations canonicalise to the base category (BUILD_PROMPT §7.5)
    alternates: { canonical: `/category/${cat.slug}${filtered && (filters.page ?? 1) > 1 && !hasActiveFilters(filters) ? filtersToQuery({ page: filters.page }) : ""}` },
    robots: hasActiveFilters(filters) ? { index: false, follow: true } : undefined,
  };
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(publicEnv.siteUrl, crumbs)) }} />
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
