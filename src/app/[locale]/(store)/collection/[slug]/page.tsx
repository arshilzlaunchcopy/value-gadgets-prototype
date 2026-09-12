import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/store/breadcrumbs";
import { ProductListing } from "@/components/store/product-listing";
import { staticParamsSafe } from "@/lib/build-safe";
import { hasActiveFilters, parseListFilters, type SearchParams } from "@/lib/catalog/filters";
import { getAllCollections, getCollectionBySlug, getCollectionProducts } from "@/lib/catalog/queries";
import { publicEnv } from "@/lib/env.public";
import { localeContext } from "@/lib/i18n/server";
import { itemListJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { getStoreSettings } from "@/lib/settings";

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<SearchParams> };

export async function generateStaticParams() {
  return staticParamsSafe("collections", async () => (await getAllCollections()).map((c) => ({ slug: c.slug })));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ locale, slug }, sp, store] = await Promise.all([params, searchParams, getStoreSettings()]);
  const col = await getCollectionBySlug(slug);
  if (!col) return {};
  const L = await localeContext(locale);
  const filters = parseListFilters(sp);
  const name = L.pick(col.title_en, col.title_bn);
  return buildMetadata({
    entityType: "collection",
    entityId: col.id,
    locale: L.locale,
    path: `/collection/${col.slug}`,
    templateVars: { name, title: name },
    fallbackDescription: col.description_en ?? `${col.title_en} at ${store.name}. Genuine products, official warranty, cash on delivery across Bangladesh.`,
    image: col.image_url ? { url: col.image_url } : null,
    noindex: hasActiveFilters(filters),
  });
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const [{ locale, slug }, sp] = await Promise.all([params, searchParams]);
  const col = await getCollectionBySlug(slug);
  if (!col) notFound();
  const L = await localeContext(locale);
  const filters = parseListFilters(sp);
  const list = await getCollectionProducts(col.id, filters);
  const name = L.pick(col.title_en, col.title_bn);
  const crumbs = [{ label: name, href: `/collection/${col.slug}` }];
  return (
    <>
      <JsonLd data={[breadcrumbJsonLd(publicEnv.siteUrl, crumbs), itemListJsonLd(col.title_en, `/collection/${col.slug}`, list.items)]} />
      <Breadcrumbs items={crumbs} locale={L.locale} />
      <header className="mb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">{name}</h1>
        {col.description_en && <p className="text-muted-foreground mt-2 max-w-2xl text-sm">{col.description_en}</p>}
      </header>
      <ProductListing basePath={`/collection/${col.slug}`} filters={filters} list={list} locale={L.locale} />
    </>
  );
}
