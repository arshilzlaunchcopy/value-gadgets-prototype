import { z } from "zod";
import { ProductCard } from "@/components/store/product-card";
import { SectionHeading } from "@/components/store/product-grid";
import { getProductsForSource, type ProductSummary } from "@/lib/catalog/queries";
import { defineBlock } from "../define";

const schema = z.object({
  title_en: z.string().max(80).optional().or(z.literal("")),
  title_bn: z.string().max(80).optional().or(z.literal("")),
  source: z.enum(["collection", "category", "newest", "on_sale", "best_selling", "featured", "manual"]).default("collection"),
  source_slug: z.string().max(120).optional().or(z.literal("")).describe("Collection or category slug (for those sources)"),
  product_slugs: z.array(z.string().max(120)).max(24).default([]).describe("Manual source: product slugs in order"),
  limit: z.number().int().min(2).max(24).default(8),
  layout: z.enum(["carousel", "grid"]).default("carousel"),
  view_all_href: z.string().max(300).optional().or(z.literal("")),
});

export default defineBlock<typeof schema, ProductSummary[]>({
  type: "product_carousel",
  label: "Product carousel",
  icon: "ShoppingBag",
  description: "Products from a collection, category, rule, or a manual list.",
  allowedOn: ["home", "product", "category", "collection", "page", "landing", "custom"],
  schema,
  defaults: { title_en: "Best sellers", source: "collection", source_slug: "best-sellers", product_slugs: [], limit: 8, layout: "carousel", view_all_href: "/collection/best-sellers" },
  loader: (s) => getProductsForSource({ source: s.source, slug: s.source_slug || undefined, slugs: s.product_slugs, limit: s.limit }),
  component: ({ settings, data, locale }) => {
    const title = (locale === "bn" && settings.title_bn) || settings.title_en;
    if (!data?.length) return null;
    return (
      <div>
        {title && <SectionHeading title={title} href={settings.view_all_href || undefined} />}
        {settings.layout === "grid" ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {data.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
            {data.map((p) => (
              <li key={p.id} className="w-[46vw] shrink-0 snap-start sm:w-56 lg:w-64">
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  },
});
