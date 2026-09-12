import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { preconnect, preload } from "react-dom";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/store/breadcrumbs";
import { RecentlyViewedTracker } from "@/components/store/blocks/recently-viewed";
import { ProductPurchase } from "@/components/store/pdp/product-purchase";
import { Description, Highlights, Reviews, SpecTable, TrustRow } from "@/components/store/pdp/sections";
import { ProductGrid, SectionHeading } from "@/components/store/product-grid";
import { RatingStars } from "@/components/store/rating-stars";
import { getAllProductSlugs, getProductBySlug } from "@/lib/catalog/queries";
import { staticParamsSafe } from "@/lib/build-safe";
import { publicEnv } from "@/lib/env.public";
import { truncate } from "@/lib/format";
import { getPublicSettings } from "@/lib/settings";

export const revalidate = 3600;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return staticParamsSafe("products", async () => (await getAllProductSlugs()).map((p) => ({ slug: p.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getProductBySlug(slug);
  if (!detail) return {};
  const { product } = detail;
  const description = truncate(product.short_description ?? product.description_en ?? product.title_en, 155);
  return {
    title: `${product.title_en} - Price in Bangladesh`,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.title_en,
      description,
      type: "website",
      url: `/products/${product.slug}`,
      images: product.image ? [{ url: product.image.src, width: product.image.width, height: product.image.height, alt: product.image.alt }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [detail, settings] = await Promise.all([getProductBySlug(slug), getPublicSettings()]);
  if (!detail) notFound();
  const { product, variants, images, reviews, category, related, shipping } = detail;
  const url = new URL(`/products/${product.slug}`, publicEnv.siteUrl).toString();

  // The main product image is the LCP element (BUILD_PROMPT §7.9): preload it from <head>
  // so it is not queued behind scripts. Matches the WebP srcset the gallery renders.
  const lcp = images[0]?.picture;
  if (lcp) {
    preconnect(new URL(lcp.src).origin);
    preload(lcp.src, { as: "image", fetchPriority: "high", imageSrcSet: lcp.webpSrcSet, imageSizes: "(min-width: 1024px) 50vw, 100vw" });
  }
  const crumbs = [...(category ? [{ label: category.name_en, href: `/category/${category.slug}` }] : []), { label: product.title_en, href: `/products/${product.slug}` }];

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title_en,
    description: product.short_description ?? undefined,
    image: images.map((i) => i.picture.src),
    sku: variants[0]?.sku,
    brand: product.brand_name ? { "@type": "Brand", name: product.brand_name } : undefined,
    url,
    ...(product.review_count > 0 && product.avg_rating
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.avg_rating, reviewCount: product.review_count, bestRating: 5, worstRating: 1 } }
      : {}),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "BDT",
      lowPrice: Math.min(...variants.map((v) => v.price_bdt)),
      highPrice: Math.max(...variants.map((v) => v.price_bdt)),
      offerCount: variants.length,
      availability: product.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      priceValidUntil: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
      url,
      seller: { "@type": "Organization", name: settings.store.name },
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(publicEnv.siteUrl, crumbs)) }} />
      <Breadcrumbs items={crumbs} />
      <RecentlyViewedTracker slug={product.slug} />

      <ProductPurchase
        productTitle={product.title_en}
        images={images.map((i) => ({ id: i.id, variant_id: i.variant_id, picture: i.picture }))}
        variants={variants}
        infoSlot={
          <div>
            {product.brand_name && product.brand_slug && (
              <Link href={`/search?q=${encodeURIComponent(product.brand_name)}`} className="text-muted-foreground text-sm hover:underline">
                {product.brand_name}
              </Link>
            )}
            <h1 className="mt-1 text-2xl font-semibold leading-tight sm:text-3xl">{product.title_en}</h1>
            {product.title_bn && (
              <p lang="bn" className="text-muted-foreground mt-1">
                {product.title_bn}
              </p>
            )}
            <div className="mt-2">
              <RatingStars rating={product.avg_rating} count={product.review_count} />
            </div>
            {product.short_description && <p className="text-muted-foreground mt-3 text-sm">{product.short_description}</p>}
          </div>
        }
        trustSlot={<TrustRow warrantyMonths={product.warranty_months} shipping={shipping} returnDays={settings.delivery.return_days} />}
      />

      <div className="mt-10 space-y-10">
        <Highlights items={product.highlights} />
        <SpecTable specs={product.specs} />
        <Description text={product.description_en} />
        <Reviews reviews={reviews} avg={product.avg_rating} count={product.review_count} />
        {related.length > 0 && (
          <section>
            <SectionHeading title="Related products" href={category ? `/category/${category.slug}` : undefined} />
            <ProductGrid products={related} eager={0} />
          </section>
        )}
      </div>
    </>
  );
}
