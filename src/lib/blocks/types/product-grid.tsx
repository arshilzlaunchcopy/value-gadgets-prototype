import { z } from "zod";
import { ProductGrid, SectionHeading } from "@/components/store/product-grid";
import { getProductsForSource, type ProductSummary } from "@/lib/catalog/queries";
import { defineBlock } from "../define";

const schema = z.object({
  title_en: z.string().max(80).optional().or(z.literal("")),
  title_bn: z.string().max(80).optional().or(z.literal("")),
  source: z.enum(["collection", "category", "newest", "on_sale", "best_selling", "featured", "manual"]).default("newest"),
  source_slug: z.string().max(120).optional().or(z.literal("")).describe("Collection or category slug"),
  product_slugs: z.array(z.string().max(120)).max(24).default([]).describe("Manual source: product slugs in order"),
  limit: z.number().int().min(2).max(24).default(8),
  view_all_href: z.string().max(300).optional().or(z.literal("")),
});

export default defineBlock<typeof schema, ProductSummary[]>({
  type: "product_grid",
  label: "Product grid",
  icon: "Grid2x2",
  description: "A responsive grid of products from any source (2 / 3 / 4 columns).",
  allowedOn: ["home", "category", "collection", "page", "landing", "custom"],
  schema,
  defaults: { title_en: "New arrivals", source: "newest", source_slug: "", product_slugs: [], limit: 8, view_all_href: "/collection/new-arrivals" },
  loader: (s) => getProductsForSource({ source: s.source, slug: s.source_slug || undefined, slugs: s.product_slugs, limit: s.limit }),
  component: ({ settings, data, locale }) => {
    const title = (locale === "bn" && settings.title_bn) || settings.title_en;
    if (!data?.length) return null;
    return (
      <div>
        {title && <SectionHeading title={title} href={settings.view_all_href || undefined} />}
        <ProductGrid products={data} eager={0} />
      </div>
    );
  },
});
