import { z } from "zod";
import { CountdownTimer } from "@/components/store/blocks/countdown-timer";
import { ProductCard } from "@/components/store/product-card";
import { getProductsForSource, type ProductSummary } from "@/lib/catalog/queries";
import { defineBlock } from "../define";

const schema = z.object({
  title_en: z.string().min(1).max(80).default("Flash sale"),
  title_bn: z.string().max(80).optional().or(z.literal("")),
  subtitle_en: z.string().max(160).optional().or(z.literal("")),
  ends_at: z.string().min(1).describe("ISO date-time the deal ends, e.g. 2026-09-30T23:59:00+06:00"),
  source: z.enum(["on_sale", "collection", "manual"]).default("on_sale"),
  source_slug: z.string().max(120).optional().or(z.literal("")),
  product_slugs: z.array(z.string().max(120)).max(12).default([]),
  limit: z.number().int().min(2).max(12).default(4),
  cta_href: z.string().max(300).optional().or(z.literal("")),
  hide_when_over: z.boolean().default(true),
});

export default defineBlock<typeof schema, ProductSummary[]>({
  type: "countdown_deal",
  label: "Countdown deal",
  icon: "Timer",
  description: "Flash sale strip with a live timer and the deal products.",
  allowedOn: ["home", "page", "landing", "custom", "collection"],
  schema,
  defaults: { title_en: "Eid flash sale", subtitle_en: "Prices go back up when the timer hits zero.", ends_at: new Date(Date.now() + 3 * 86_400_000).toISOString(), source: "on_sale", source_slug: "", product_slugs: [], limit: 4, cta_href: "/collection/eid-offers", hide_when_over: true },
  loader: (s) => getProductsForSource({ source: s.source, slug: s.source_slug || undefined, slugs: s.product_slugs, limit: s.limit }),
  component: ({ settings, data, locale }) => {
    const ends = new Date(settings.ends_at);
    if (Number.isNaN(ends.getTime())) return null;
    if (settings.hide_when_over && ends.getTime() < Date.now()) return null;
    const title = (locale === "bn" && settings.title_bn) || settings.title_en;
    return (
      <div className="bg-ink text-paper rounded-2xl p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">{title}</h2>
            {settings.subtitle_en && <p className="text-paper/70 text-sm">{settings.subtitle_en}</p>}
          </div>
          <CountdownTimer endsAt={ends.toISOString()} />
        </div>
        {data && data.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {data.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} locale={locale} />
              </li>
            ))}
          </ul>
        )}
        {settings.cta_href && (
          <a href={settings.cta_href} className="text-amber mt-4 inline-block text-sm font-medium underline-offset-4 hover:underline">
            See every deal
          </a>
        )}
      </div>
    );
  },
});
