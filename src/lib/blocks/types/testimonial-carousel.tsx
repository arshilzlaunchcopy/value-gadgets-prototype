/* eslint-disable @next/next/no-img-element -- customer avatars from the media library */
import { z } from "zod";
import { RatingStars } from "@/components/store/rating-stars";
import { defineBlock } from "../define";

const schema = z.object({
  title_en: z.string().max(80).default("What customers say"),
  title_bn: z.string().max(80).optional().or(z.literal("")),
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        location: z.string().max(60).optional().or(z.literal("")),
        quote: z.string().min(3).max(400),
        rating: z.number().int().min(1).max(5).default(5),
        avatar_image: z.string().max(500).optional().or(z.literal("")),
        product_label: z.string().max(80).optional().or(z.literal("")).describe("What they bought"),
      }),
    )
    .min(1)
    .max(12),
});

export default defineBlock({
  type: "testimonial_carousel",
  label: "Testimonials",
  icon: "MessageSquareQuote",
  description: "Customer quotes with ratings; swipes on phones.",
  allowedOn: ["home", "product", "page", "landing", "custom", "category", "collection"],
  schema,
  defaults: {
    title_en: "What customers say",
    items: [
      { name: "Rafiul Islam", location: "Mirpur, Dhaka", quote: "Ordered at night, delivered next afternoon. The hub works with my MacBook exactly as promised.", rating: 5, avatar_image: "", product_label: "UGREEN 8-in-1 hub" },
      { name: "Sadia Khanam", location: "Chattogram", quote: "Took 3 days to Chattogram, cash on delivery, sealed box with warranty card. Will buy again.", rating: 5, avatar_image: "", product_label: "Anker 65W charger" },
      { name: "Tanvir Ahmed", location: "Sylhet", quote: "Real product, real warranty. Replacement handled on WhatsApp within a day.", rating: 4, avatar_image: "", product_label: "JBL Tune 510BT" },
    ],
  },
  component: ({ settings, locale }) => (
    <div>
      <h2 className="mb-4 text-xl font-semibold sm:text-2xl">{(locale === "bn" && settings.title_bn) || settings.title_en}</h2>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
        {settings.items.map((t, i) => (
          <li key={i} className="bg-paper w-[80vw] shrink-0 snap-start rounded-2xl border p-4 sm:w-auto">
            <RatingStars rating={t.rating} count={1} size={14} showCount={false} />
            <blockquote className="mt-2 text-sm leading-relaxed">“{t.quote}”</blockquote>
            <footer className="mt-3 flex items-center gap-2 text-xs">
              {t.avatar_image ? <img src={t.avatar_image} alt="" className="size-8 rounded-full object-cover" loading="lazy" /> : <span className="bg-ink text-amber grid size-8 place-items-center rounded-full text-[11px] font-bold">{t.name.slice(0, 1)}</span>}
              <span>
                <span className="block font-semibold">{t.name}</span>
                <span className="text-muted-foreground">{[t.location, t.product_label].filter(Boolean).join(" · ")}</span>
              </span>
            </footer>
          </li>
        ))}
      </ul>
    </div>
  ),
});
