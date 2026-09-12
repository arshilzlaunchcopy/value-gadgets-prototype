import Link from "next/link";
import type { ProductSummary } from "@/lib/catalog/queries";
import { t, type Locale } from "@/lib/i18n/messages";
import { Picture } from "./picture";
import { DiscountBadge, Price } from "./price";
import { RatingStars } from "./rating-stars";

/** White surface, 1:1 image, no shadow at rest, ring-amber on hover (BUILD_PROMPT §3). */
export function ProductCard({ product, priority = false, locale = "en" }: { product: ProductSummary; priority?: boolean; locale?: Locale }) {
  const href = `/products/${product.slug}`;
  const title = (locale === "bn" && product.title_bn) || product.title_en;
  return (
    <article className="group bg-paper hover:ring-amber relative flex flex-col overflow-hidden rounded-2xl ring-1 ring-transparent transition">
      <Link href={href} className="relative block aspect-square overflow-hidden" tabIndex={-1} aria-hidden="true">
        <Picture
          data={product.image}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          priority={priority}
          className="block h-full w-full"
          imgClassName="h-full w-full object-cover transition group-hover:scale-[1.02]"
        />
        <DiscountBadge price={product.price_bdt} compareAt={product.compare_at_bdt} className="absolute top-2 left-2" />
        {!product.in_stock && <span className="bg-ink/80 text-paper absolute right-2 bottom-2 rounded-lg px-2 py-0.5 text-xs">{t(locale, "catalog.out_of_stock")}</span>}
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-3">
        {product.brand_name && <span className="text-muted-foreground text-xs">{product.brand_name}</span>}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug" lang={locale === "bn" && product.title_bn ? "bn" : undefined}>
          <Link href={href} className="after:absolute after:inset-0 after:content-['']">
            {title}
          </Link>
        </h3>
        <RatingStars rating={product.avg_rating} count={product.review_count} size={12} emptyLabel={t(locale, "catalog.no_reviews")} />
        <Price price={product.price_bdt} compareAt={product.compare_at_bdt} className="mt-auto pt-1" />
      </div>
    </article>
  );
}
