import Markdown from "react-markdown";
import { z } from "zod";
import { defineBlock } from "../define";

const schema = z.object({
  heading_en: z.string().max(120).optional().or(z.literal("")),
  heading_bn: z.string().max(120).optional().or(z.literal("")),
  body_markdown_en: z.string().max(20000).describe("Markdown"),
  body_markdown_bn: z.string().max(20000).optional().or(z.literal("")).describe("Markdown (Bangla)"),
  width: z.enum(["narrow", "wide"]).default("narrow"),
});

export default defineBlock({
  type: "rich_text",
  label: "Rich text",
  icon: "Text",
  description: "Markdown content with an optional heading.",
  allowedOn: ["home", "product", "category", "collection", "page", "landing", "custom"],
  schema,
  defaults: { heading_en: "Why buy from us", body_markdown_en: "Genuine products, **official warranty**, and delivery anywhere in Bangladesh.", width: "narrow" },
  component: ({ settings, locale }) => {
    const heading = (locale === "bn" && settings.heading_bn) || settings.heading_en;
    const body = (locale === "bn" && settings.body_markdown_bn) || settings.body_markdown_en;
    return (
      <div className={settings.width === "narrow" ? "mx-auto max-w-2xl" : ""} lang={locale === "bn" && settings.body_markdown_bn ? "bn" : undefined}>
        {heading && <h2 className="mb-3 text-xl font-semibold sm:text-2xl">{heading}</h2>}
        <div className="prose prose-neutral max-w-none text-sm leading-relaxed [&_a]:underline [&_h3]:mt-4 [&_h3]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_p]:my-2">
          <Markdown>{body}</Markdown>
        </div>
      </div>
    );
  },
});
