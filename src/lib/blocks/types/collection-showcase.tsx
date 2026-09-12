/* eslint-disable @next/next/no-img-element -- collection cover from the media library */
import Link from "next/link";
import { z } from "zod";
import { ProductCard } from "@/components/store/product-card";
import { getCollectionBySlug, getCollectionProducts, type CollectionSummary, type ProductSummary } from "@/lib/catalog/queries";
import { defineBlock } from "../define";

const schema = z.object({
  collection_slug: z.string().min(1).max(120),
  heading_en: z.string().max(120).optional().or(z.literal("")).describe("Blank = collection title"),
  text_en: z.string().max(300).optional().or(z.literal("")),
  cover_image: z.string().max(500).optional().or(z.literal("")).describe("Blank = collection image"),
  limit: z.number().int().min(2).max(8).default(4),
  cta_label_en: z.string().max(40).default("Shop the collection"),
});

type Data = { collection: CollectionSummary; products: ProductSummary[] } | null;

export default defineBlock<typeof schema, Data>({
  type: "collection_showcase",
  label: "Collection showcase",
  icon: "Sparkles",
  description: "One collection: cover, copy, a few products and a CTA.",
  allowedOn: ["home", "page", "landing", "custom", "category"],
  schema,
  defaults: { collection_slug: "eid-offers", heading_en: "", text_en: "Limited-time prices on chargers, cables and audio.", cover_image: "", limit: 4, cta_label_en: "Shop the collection" },
  loader: async (s) => {
    const collection = await getCollectionBySlug(s.collection_slug);
    if (!collection) return null;
    const { items } = await getCollectionProducts(collection.id, { page: 1 });
    return { collection, products: items.slice(0, s.limit) };
  },
  component: ({ settings, data, locale }) => {
    if (!data) return null;
    const { collection, products } = data;
    const heading = settings.heading_en || (locale === "bn" && collection.title_bn) || collection.title_en;
    const cover = settings.cover_image || collection.image_url;
    return (
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Link href={`/collection/${collection.slug}`} className="bg-ink text-paper relative flex min-h-56 flex-col justify-end overflow-hidden rounded-2xl p-6">
          {cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" loading="lazy" />}
          <span className="relative">
            <span className="text-amber text-xs font-semibold tracking-wide uppercase">Collection</span>
            <span className="block text-2xl font-semibold leading-tight">{heading}</span>
            {(settings.text_en || collection.description_en) && <span className="text-paper/80 mt-1 block text-sm">{settings.text_en || collection.description_en}</span>}
            <span className="bg-amber text-ink mt-3 inline-flex rounded-2xl px-4 py-2 text-sm font-semibold">{settings.cta_label_en}</span>
          </span>
        </Link>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {products.map((p) => (
            <li key={p.id}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      </div>
    );
  },
});
