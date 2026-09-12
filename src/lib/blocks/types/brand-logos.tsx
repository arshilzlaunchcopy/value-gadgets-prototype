/* eslint-disable @next/next/no-img-element -- brand logos from the media library */
import Link from "next/link";
import { z } from "zod";
import { defineBlock } from "../define";

const schema = z.object({
  title_en: z.string().max(80).optional().or(z.literal("")),
  logos: z
    .array(
      z.object({
        name: z.string().min(1).max(40),
        logo_image: z.string().max(500).optional().or(z.literal("")).describe("Blank = the name in text"),
        href: z.string().max(300).optional().or(z.literal("")),
      }),
    )
    .min(2)
    .max(12),
  grayscale: z.boolean().default(true),
});

export default defineBlock({
  type: "brand_logos",
  label: "Brand logos",
  icon: "Award",
  description: "Row of brands you carry (authorised-seller trust signal).",
  allowedOn: ["home", "page", "landing", "custom", "category"],
  schema,
  defaults: {
    title_en: "Authorised seller for",
    logos: ["UGREEN", "Anker", "Baseus", "JBL", "Xiaomi", "SanDisk"].map((name) => ({ name, logo_image: "", href: `/search?q=${encodeURIComponent(name)}` })),
    grayscale: true,
  },
  component: ({ settings }) => (
    <div className="text-center">
      {settings.title_en && <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">{settings.title_en}</p>}
      <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
        {settings.logos.map((b, i) => {
          const inner = b.logo_image ? <img src={b.logo_image} alt={b.name} className={`h-8 w-auto ${settings.grayscale ? "opacity-70 grayscale hover:opacity-100 hover:grayscale-0" : ""}`} loading="lazy" /> : <span className="text-lg font-bold tracking-wide">{b.name}</span>;
          return <li key={i}>{b.href ? <Link href={b.href} className="inline-block transition">{inner}</Link> : inner}</li>;
        })}
      </ul>
    </div>
  ),
});
