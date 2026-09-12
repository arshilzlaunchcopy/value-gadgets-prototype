import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import { z } from "zod";
import { FeaturedBuyBox } from "@/components/store/blocks/featured-buy-box";
import { Picture } from "@/components/store/picture";
import { RatingStars } from "@/components/store/rating-stars";
import { getProductBySlug, type ProductDetail } from "@/lib/catalog/queries";
import { defineBlock } from "../define";

const schema = z.object({
  product_slug: z.string().min(1).max(120),
  eyebrow_en: z.string().max(40).optional().or(z.literal("")),
  heading_en: z.string().max(120).optional().or(z.literal("")).describe("Blank = product title"),
  text_en: z.string().max(400).optional().or(z.literal("")).describe("Blank = short description"),
  show_highlights: z.boolean().default(true),
  image_side: z.enum(["left", "right"]).default("left"),
  buy_label_en: z.string().max(40).default("Add to cart"),
});

export default defineBlock<typeof schema, ProductDetail | null>({
  type: "featured_product",
  label: "Featured product",
  icon: "Star",
  description: "Single product spotlight with price and a buy button.",
  allowedOn: ["home", "page", "landing", "custom", "category", "collection"],
  schema,
  defaults: { product_slug: "ugreen-8-in-1-usb-c-hub", eyebrow_en: "Featured", heading_en: "", text_en: "", show_highlights: true, image_side: "left", buy_label_en: "Add to cart" },
  loader: (s) => getProductBySlug(s.product_slug),
  component: ({ settings, data, locale }) => {
    if (!data) return null;
    const { product, variants, images } = data;
    const heading = settings.heading_en || (locale === "bn" && product.title_bn) || product.title_en;
    const text = settings.text_en || product.short_description;
    return (
      <div className="bg-paper grid items-center gap-6 overflow-hidden rounded-2xl border sm:grid-cols-2">
        <Link href={`/products/${product.slug}`} className={`block ${settings.image_side === "right" ? "sm:order-2" : ""}`} tabIndex={-1} aria-hidden="true">
          <Picture data={images[0]?.picture ?? product.image} sizes="(min-width: 640px) 50vw, 100vw" className="block aspect-square" imgClassName="h-full w-full object-cover" />
        </Link>
        <div className="space-y-3 p-6 sm:p-8">
          {settings.eyebrow_en && <p className="text-amber-deep text-xs font-semibold tracking-wide uppercase">{settings.eyebrow_en}</p>}
          <h2 className="text-2xl font-semibold leading-tight">
            <Link href={`/products/${product.slug}`}>{heading}</Link>
          </h2>
          <RatingStars rating={product.avg_rating} count={product.review_count} />
          {text && <p className="text-muted-foreground text-sm">{text}</p>}
          {settings.show_highlights && product.highlights.length > 0 && (
            <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
              {product.highlights.slice(0, 4).map((h) => (
                <li key={h} className="flex items-start gap-2">
                  <BadgeCheck className="text-amber-deep mt-0.5 size-4 shrink-0" />
                  {h}
                </li>
              ))}
            </ul>
          )}
          <FeaturedBuyBox variants={variants} label={settings.buy_label_en} />
        </div>
      </div>
    );
  },
});
