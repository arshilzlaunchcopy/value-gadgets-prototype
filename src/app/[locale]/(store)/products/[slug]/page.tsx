import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { preconnect, preload } from "react-dom";
import { TrackViewItem } from "@/components/analytics/trackers";
import { JsonLd } from "@/components/seo/json-ld";
import { RecentlyViewedTracker } from "@/components/store/blocks/recently-viewed";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/store/breadcrumbs";
import { ProductPurchase } from "@/components/store/pdp/product-purchase";
import { Description, Highlights, Reviews, SpecTable, TrustRow } from "@/components/store/pdp/sections";
import { ProductGrid, SectionHeading } from "@/components/store/product-grid";
import { RatingStars } from "@/components/store/rating-stars";
import { staticParamsSafe } from "@/lib/build-safe";
import { getAllProductSlugs, getProductBySlug } from "@/lib/catalog/queries";
import { publicEnv } from "@/lib/env.public";
import { localeContext } from "@/lib/i18n/server";
import { productJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { getPublicSettings } from "@/lib/settings";

export const revalidate = 3600;
export const dynamicParams = true;

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateStaticParams() {
  return staticParamsSafe("products", async () => (await getAllProductSlugs()).map((p) => ({ slug: p.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const detail = await getProductBySlug(slug);
  if (!detail) return {};
  const L = await localeContext(locale);
  const { product } = detail;
  return buildMetadata({
    entityType: "product",
    entityId: product.id,
    locale: L.locale,
    path: `/products/${product.slug}`,
    templateVars: { title: L.pick(product.title_en, product.title_bn) },
    fallbackDescription: product.short_description ?? product.description_en ?? product.title_en,
    image: product.image ? { url: product.image.src, width: product.image.width, height: product.image.height, alt: product.image.alt } : null,
    ogType: "product",
  });
}

export default async function ProductPage({ params }: Props) {
  const { locale, slug } = await params;
  const [detail, settings, L] = await Promise.all([getProductBySlug(slug), getPublicSettings(), localeContext(locale)]);
  if (!detail) notFound();
  const { product, variants, images, reviews, category, related, shipping } = detail;
  const { t } = L;

  // The main product image is the LCP element (BUILD_PROMPT §7.9): preload it from <head>
  // so it is not queued behind scripts. Matches the WebP srcset the gallery renders.
  const lcp = images[0]?.picture;
  if (lcp) {
    preconnect(new URL(lcp.src).origin);
    preload(lcp.src, { as: "image", fetchPriority: "high", imageSrcSet: lcp.webpSrcSet, imageSizes: "(min-width: 1024px) 50vw, 100vw" });
  }
  const title = L.pick(product.title_en, product.title_bn);
  const crumbs = [...(category ? [{ label: L.pick(category.name_en, category.name_bn), href: `/category/${category.slug}` }] : []), { label: title, href: `/products/${product.slug}` }];
  const defaultVariant = variants.find((v) => v.is_default) ?? variants[0];
  const description = L.locale === "bn" && detail.product.description_bn ? detail.product.description_bn : product.description_en;

  return (
    <>
      <JsonLd data={[productJsonLd(detail, settings.store, { gtin: defaultVariant?.gtin, mpn: defaultVariant?.mpn }), breadcrumbJsonLd(publicEnv.siteUrl, crumbs)]} />
      <Breadcrumbs items={crumbs} locale={L.locale} />
      <RecentlyViewedTracker slug={product.slug} />
      <TrackViewItem item={{ id: defaultVariant?.id ?? product.id, name: product.title_en, price_bdt: defaultVariant?.price_bdt ?? product.price_bdt, variant: defaultVariant?.option_value, brand: product.brand_name }} />

      <ProductPurchase
        productTitle={title}
        images={images.map((i) => ({ id: i.id, variant_id: i.variant_id, picture: i.picture }))}
        variants={variants}
        infoSlot={
          <div>
            {product.brand_name && product.brand_slug && (
              <Link href={`/search?q=${encodeURIComponent(product.brand_name)}`} className="text-muted-foreground text-sm hover:underline">
                {product.brand_name}
              </Link>
            )}
            <h1 className="mt-1 text-2xl font-semibold leading-tight sm:text-3xl">{title}</h1>
            {L.locale === "en" && product.title_bn && (
              <p lang="bn" className="text-muted-foreground mt-1">
                {product.title_bn}
              </p>
            )}
            {L.locale === "bn" && (
              <p lang="en" className="text-muted-foreground mt-1 text-sm">
                {product.title_en}
              </p>
            )}
            <div className="mt-2">
              <RatingStars rating={product.avg_rating} count={product.review_count} emptyLabel={t("catalog.no_reviews")} />
            </div>
            {product.short_description && <p className="text-muted-foreground mt-3 text-sm">{product.short_description}</p>}
          </div>
        }
        trustSlot={<TrustRow warrantyMonths={product.warranty_months} shipping={shipping} returnDays={settings.delivery.return_days} L={L} />}
      />

      <div className="mt-10 space-y-10">
        <Highlights items={product.highlights} L={L} />
        <SpecTable specs={product.specs} L={L} />
        <Description text={description} L={L} />
        <Reviews reviews={reviews} avg={product.avg_rating} count={product.review_count} L={L} />
        {related.length > 0 && (
          <section>
            <SectionHeading title={t("catalog.related")} href={category ? `/category/${category.slug}` : undefined} hrefLabel={t("catalog.view_all")} />
            <ProductGrid products={related} eager={0} />
          </section>
        )}
      </div>
    </>
  );
}
