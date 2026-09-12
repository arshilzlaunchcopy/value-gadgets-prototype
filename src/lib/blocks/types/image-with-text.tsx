/* eslint-disable @next/next/no-img-element -- media-library image */
import Link from "next/link";
import { z } from "zod";
import { defineBlock } from "../define";

const schema = z.object({
  image_url: z.string().url().or(z.literal("")).describe("Image (square or 4:3 works best)"),
  alt_text: z.string().min(1).max(160),
  image_side: z.enum(["left", "right"]).default("left"),
  eyebrow_en: z.string().max(40).optional().or(z.literal("")),
  heading_en: z.string().min(1).max(120),
  heading_bn: z.string().max(120).optional().or(z.literal("")),
  text_en: z.string().max(600).optional().or(z.literal("")),
  cta_label_en: z.string().max(40).optional().or(z.literal("")),
  cta_href: z.string().max(300).optional().or(z.literal("")),
  dark: z.boolean().default(false).describe("Ink background"),
});

export default defineBlock({
  type: "image_with_text",
  label: "Image with text",
  icon: "Image",
  description: "Feature section: image on one side, copy and CTA on the other.",
  allowedOn: ["home", "product", "category", "collection", "page", "landing", "custom"],
  schema,
  defaults: { image_url: "", alt_text: "Feature", image_side: "left", eyebrow_en: "Warranty", heading_en: "Every product ships with an official warranty", text_en: "6 to 24 months, handled by us, no runaround.", cta_label_en: "Learn more", cta_href: "/pages/refund", dark: false },
  component: ({ settings, locale }) => {
    const heading = (locale === "bn" && settings.heading_bn) || settings.heading_en;
    return (
      <div className={`grid items-center gap-6 overflow-hidden rounded-2xl border sm:grid-cols-2 ${settings.dark ? "bg-ink text-paper border-ink-line" : "bg-paper"}`}>
        <div className={settings.image_side === "right" ? "sm:order-2" : ""}>
          {settings.image_url ? <img src={settings.image_url} alt={settings.alt_text} className="aspect-[4/3] w-full object-cover" loading="lazy" /> : <div className="bg-paper-line aspect-[4/3]" aria-hidden="true" />}
        </div>
        <div className="space-y-3 p-6 sm:p-8">
          {settings.eyebrow_en && <p className="text-amber-deep text-xs font-semibold tracking-wide uppercase">{settings.eyebrow_en}</p>}
          <h2 className="text-2xl font-semibold leading-tight">{heading}</h2>
          {settings.text_en && <p className={`text-sm ${settings.dark ? "text-paper/80" : "text-muted-foreground"}`}>{settings.text_en}</p>}
          {settings.cta_label_en && settings.cta_href && (
            <Link href={settings.cta_href} className="bg-amber text-ink hover:bg-amber-lite inline-flex rounded-2xl px-5 py-2.5 text-sm font-semibold">
              {settings.cta_label_en}
            </Link>
          )}
        </div>
      </div>
    );
  },
});
