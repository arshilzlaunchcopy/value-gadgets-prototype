import { z } from "zod";
import { NewsletterForm } from "@/components/store/blocks/newsletter-form";
import { defineBlock } from "../define";

const schema = z.object({
  heading_en: z.string().min(1).max(80).default("Get the deals first"),
  heading_bn: z.string().max(80).optional().or(z.literal("")),
  text_en: z.string().max(200).optional().or(z.literal("")),
  collect: z.enum(["email", "phone", "both"]).default("phone").describe("SMS works better than email in Bangladesh"),
  button_label_en: z.string().max(30).default("Subscribe"),
  style: z.enum(["light", "dark", "amber"]).default("amber"),
});

export default defineBlock({
  type: "newsletter_signup",
  label: "Newsletter / SMS signup",
  icon: "Mail",
  description: "Captures email and/or phone into newsletter_subscribers.",
  allowedOn: ["home", "page", "landing", "custom", "category", "collection"],
  schema,
  defaults: { heading_en: "Get the deals first", text_en: "One SMS a week with the best prices. Opt out anytime.", collect: "phone", button_label_en: "Subscribe", style: "amber" },
  component: ({ settings, locale }) => (
    <NewsletterForm heading={(locale === "bn" && settings.heading_bn) || settings.heading_en} text={settings.text_en || ""} collect={settings.collect} buttonLabel={settings.button_label_en} style={settings.style} locale={locale} />
  ),
});
