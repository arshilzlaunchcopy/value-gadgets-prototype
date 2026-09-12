import { z } from "zod";
import { HeroSlider } from "@/components/store/blocks/hero-slider";
import { defineBlock } from "../define";

export const heroSliderSchema = z.object({
  slides: z
    .array(
      z.object({
        image_desktop: z.string().url().or(z.literal("")).describe("Desktop image (1920x720)"),
        image_mobile: z.string().url().optional().or(z.literal("")).describe("Mobile image (750x900), optional"),
        alt_text: z.string().min(1).max(160),
        heading_en: z.string().max(120).optional().or(z.literal("")),
        heading_bn: z.string().max(120).optional().or(z.literal("")),
        subheading_en: z.string().max(240).optional().or(z.literal("")),
        cta_label_en: z.string().max(40).optional().or(z.literal("")),
        cta_href: z.string().max(300).optional().or(z.literal("")),
        text_position: z.enum(["left", "center", "right"]).default("left"),
      }),
    )
    .min(1)
    .max(6),
  autoplay_ms: z.number().int().min(0).max(15000).default(5000).describe("0 disables autoplay"),
  show_dots: z.boolean().default(true),
});

export default defineBlock({
  type: "hero_slider",
  label: "Hero slider",
  icon: "GalleryHorizontal",
  description: "Full-width campaign slides with an optional CTA.",
  allowedOn: ["home", "custom", "landing"],
  schema: heroSliderSchema,
  defaults: { slides: [{ image_desktop: "", alt_text: "Campaign banner", heading_en: "New season, new gear", text_position: "left" }], autoplay_ms: 5000, show_dots: true },
  component: ({ settings, locale }) => <HeroSlider settings={settings} locale={locale} />,
});
