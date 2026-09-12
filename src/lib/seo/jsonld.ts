import type { ProductDetail, ProductSummary } from "@/lib/catalog/queries";
import type { StoreSettings } from "@/lib/settings";
import { absoluteUrl } from "./metadata";

/**
 * JSON-LD builders (BUILD_PROMPT §7.3). Plain objects; render with <JsonLd />.
 * Shapes follow Google's structured-data references so the Rich Results Test
 * validates Product, BreadcrumbList, FAQPage, Article, Organization, LocalBusiness.
 */
export type JsonLdObject = Record<string, unknown>;

export function organizationJsonLd(store: StoreSettings): JsonLdObject {
  const sameAs = [store.facebook, store.instagram, store.youtube].filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: store.name,
    url: absoluteUrl("/"),
    ...(store.phone ? { telephone: store.phone } : {}),
    ...(store.email ? { email: store.email } : {}),
    ...(store.address ? { address: { "@type": "PostalAddress", streetAddress: store.address, addressCountry: "BD" } } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function websiteJsonLd(store: StoreSettings): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: store.name,
    url: absoluteUrl("/"),
    publisher: { "@id": absoluteUrl("/#organization") },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl("/search")}?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function localBusinessJsonLd(store: StoreSettings): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": absoluteUrl("/#localbusiness"),
    name: store.name,
    url: absoluteUrl("/"),
    image: absoluteUrl("/favicon.ico"),
    ...(store.phone ? { telephone: store.phone } : {}),
    ...(store.email ? { email: store.email } : {}),
    address: { "@type": "PostalAddress", streetAddress: store.address || "Dhaka", addressLocality: "Dhaka", addressCountry: "BD" },
    priceRange: "৳৳",
    currenciesAccepted: "BDT",
    paymentAccepted: "Cash, bKash, Nagad, Credit Card",
    openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", dayOfWeek: ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"], opens: "10:00", closes: "20:00" }],
  };
}

export function productJsonLd(detail: ProductDetail, store: StoreSettings, opts: { gtin?: string | null; mpn?: string | null } = {}): JsonLdObject {
  const { product, variants, images, reviews } = detail;
  const url = absoluteUrl(`/products/${product.slug}`);
  const priceValidUntil = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const availability = product.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
  const seller = { "@type": "Organization", name: store.name };
  const single = variants.length === 1;
  const offers = single
    ? { "@type": "Offer", url, priceCurrency: "BDT", price: variants[0].price_bdt, priceValidUntil, availability, itemCondition: "https://schema.org/NewCondition", seller, shippingDetails: shippingDetails(detail) }
    : {
        "@type": "AggregateOffer",
        url,
        priceCurrency: "BDT",
        lowPrice: Math.min(...variants.map((v) => v.price_bdt)),
        highPrice: Math.max(...variants.map((v) => v.price_bdt)),
        offerCount: variants.length,
        availability,
        priceValidUntil,
        seller,
      };
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.title_en,
    description: (product.short_description ?? product.description_en ?? product.title_en).slice(0, 500),
    image: images.map((i) => i.picture.src),
    sku: variants[0]?.sku,
    ...(opts.gtin ? { gtin: opts.gtin } : {}),
    ...(opts.mpn ? { mpn: opts.mpn } : {}),
    ...(product.brand_name ? { brand: { "@type": "Brand", name: product.brand_name } } : {}),
    url,
    offers,
    ...(product.review_count > 0 && product.avg_rating
      ? {
          aggregateRating: { "@type": "AggregateRating", ratingValue: product.avg_rating, reviewCount: product.review_count, bestRating: 5, worstRating: 1 },
          review: reviews.slice(0, 3).map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.reviewer_name ?? "Verified buyer" },
            datePublished: r.created_at.slice(0, 10),
            reviewBody: (r.body ?? r.title ?? "").slice(0, 500),
            reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
          })),
        }
      : {}),
  };
}

function shippingDetails(detail: ProductDetail) {
  const z = detail.shipping[0];
  if (!z) return undefined;
  const days = /(\d+)\s*-\s*(\d+)/.exec(z.estimated_days ?? "");
  return {
    "@type": "OfferShippingDetails",
    shippingRate: { "@type": "MonetaryAmount", value: z.rate_bdt, currency: "BDT" },
    shippingDestination: { "@type": "DefinedRegion", addressCountry: "BD" },
    ...(days ? { deliveryTime: { "@type": "ShippingDeliveryTime", transitTime: { "@type": "QuantitativeValue", minValue: Number(days[1]), maxValue: Number(days[2]), unitCode: "DAY" } } } : {}),
  };
}

export function itemListJsonLd(name: string, path: string, products: ProductSummary[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url: absoluteUrl(path),
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(`/products/${p.slug}`), name: p.title_en })),
  };
}

export function articleJsonLd(post: { slug: string; title_en: string; excerpt_en: string | null; cover_image_url: string | null; author_name: string | null; published_at: string | null; updated_at: string }, store: StoreSettings): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title_en.slice(0, 110),
    description: post.excerpt_en ?? undefined,
    image: post.cover_image_url ? [post.cover_image_url] : undefined,
    datePublished: post.published_at ?? post.updated_at,
    dateModified: post.updated_at,
    author: { "@type": "Person", name: post.author_name ?? store.name },
    publisher: { "@type": "Organization", name: store.name, "@id": absoluteUrl("/#organization") },
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
  };
}

export function faqJsonLd(items: { question: string; answer: string }[]): JsonLdObject {
  return { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: items.map((i) => ({ "@type": "Question", name: i.question, acceptedAnswer: { "@type": "Answer", text: i.answer } })) };
}
