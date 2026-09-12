import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/store/breadcrumbs";
import { ProductListing } from "@/components/store/product-listing";
import { hasActiveFilters, parseListFilters, type SearchParams } from "@/lib/catalog/filters";
import { getAllCollections, getCollectionBySlug, getCollectionProducts } from "@/lib/catalog/queries";
import { publicEnv } from "@/lib/env.public";
import { getStoreSettings } from "@/lib/settings";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

export async function generateStaticParams() {
  return (await getAllCollections()).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp, store] = await Promise.all([params, searchParams, getStoreSettings()]);
  const col = await getCollectionBySlug(slug);
  if (!col) return {};
  const filters = parseListFilters(sp);
  return {
    title: `${col.title_en} - Buy Online in Bangladesh`,
    description: col.description_en ?? `${col.title_en} at ${store.name}.`,
    alternates: { canonical: `/collection/${col.slug}` },
    robots: hasActiveFilters(filters) ? { index: false, follow: true } : undefined,
  };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const col = await getCollectionBySlug(slug);
  if (!col) notFound();
  const filters = parseListFilters(sp);
  const list = await getCollectionProducts(col.id, filters);
  const crumbs = [{ label: col.title_en, href: `/collection/${col.slug}` }];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(publicEnv.siteUrl, crumbs)) }} />
      <Breadcrumbs items={crumbs} />
      <header className="mb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">{col.title_en}</h1>
        {col.title_bn && (
          <p lang="bn" className="text-muted-foreground mt-1">
            {col.title_bn}
          </p>
        )}
        {col.description_en && <p className="text-muted-foreground mt-2 max-w-2xl text-sm">{col.description_en}</p>}
      </header>
      <ProductListing basePath={`/collection/${col.slug}`} filters={filters} list={list} />
    </>
  );
}
