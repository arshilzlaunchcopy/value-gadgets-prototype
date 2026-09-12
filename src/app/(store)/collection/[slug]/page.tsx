import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/store/breadcrumbs";
import { ProductListing } from "@/components/store/product-listing";
import { hasActiveFilters, parseListFilters, type SearchParams } from "@/lib/catalog/filters";
import { getAllCollections, getCollectionBySlug, getCollectionProducts } from "@/lib/catalog/queries";
import { staticParamsSafe } from "@/lib/build-safe";
import { publicEnv } from "@/lib/env.public";
import { itemListJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { getStoreSettings } from "@/lib/settings";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

export async function generateStaticParams() {
  return staticParamsSafe("collections", async () => (await getAllCollections()).map((c) => ({ slug: c.slug })));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp, store] = await Promise.all([params, searchParams, getStoreSettings()]);
  const col = await getCollectionBySlug(slug);
  if (!col) return {};
  const filters = parseListFilters(sp);
  return buildMetadata({
    entityType: "collection",
    entityId: col.id,
    path: `/collection/${col.slug}`,
    templateVars: { name: col.title_en, title: col.title_en },
    fallbackDescription: col.description_en ?? `${col.title_en} at ${store.name}. Genuine products, official warranty, cash on delivery across Bangladesh.`,
    image: col.image_url ? { url: col.image_url } : null,
    noindex: hasActiveFilters(filters),
  });
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
      <JsonLd data={[breadcrumbJsonLd(publicEnv.siteUrl, crumbs), itemListJsonLd(col.title_en, `/collection/${col.slug}`, list.items)]} />
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
