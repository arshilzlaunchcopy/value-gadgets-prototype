/* eslint-disable @next/next/no-img-element -- media-library banners */
import Link from "next/link";
import { z } from "zod";
import { defineBlock } from "../define";

const schema = z.object({
  banners: z
    .array(
      z.object({
        image_url: z.string().url().describe("Banner image"),
        alt_text: z.string().min(1).max(160),
        href: z.string().max(300).optional().or(z.literal("")),
        caption_en: z.string().max(80).optional().or(z.literal("")),
      }),
    )
    .min(1)
    .max(4),
  columns: z.enum(["1", "2", "3", "4"]).default("2").describe("Columns on desktop"),
  rounded: z.boolean().default(true),
});

export default defineBlock({
  type: "banner_grid",
  label: "Banner grid",
  icon: "LayoutGrid",
  description: "1 to 4 promotional images in a row.",
  allowedOn: ["home", "custom", "landing", "category", "collection"],
  schema,
  defaults: { banners: [{ image_url: "", alt_text: "Promotion", href: "/collection/eid-offers", caption_en: "Eid offers" }], columns: "2", rounded: true },
  component: ({ settings }) => {
    const cols = { "1": "grid-cols-1", "2": "grid-cols-1 sm:grid-cols-2", "3": "grid-cols-1 sm:grid-cols-3", "4": "grid-cols-2 lg:grid-cols-4" }[settings.columns];
    return (
      <ul className={`grid gap-3 ${cols}`}>
        {settings.banners.map((b, i) => {
          const inner = (
            <>
              {b.image_url ? <img src={b.image_url} alt={b.alt_text} className="aspect-[2/1] w-full object-cover" loading="lazy" /> : <div className="bg-ink-soft aspect-[2/1] w-full" aria-hidden="true" />}
              {b.caption_en && <span className="bg-ink/80 text-paper absolute bottom-3 left-3 rounded-lg px-2 py-1 text-sm font-medium">{b.caption_en}</span>}
            </>
          );
          const cls = `relative block overflow-hidden ${settings.rounded ? "rounded-2xl" : ""} bg-paper ring-2 ring-transparent hover:ring-amber transition`;
          return <li key={i}>{b.href ? <Link href={b.href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>}</li>;
        })}
      </ul>
    );
  },
});
