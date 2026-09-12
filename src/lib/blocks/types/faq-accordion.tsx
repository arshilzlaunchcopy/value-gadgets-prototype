import { z } from "zod";
import { defineBlock } from "../define";

const schema = z.object({
  title_en: z.string().max(80).default("Frequently asked questions"),
  items: z
    .array(
      z.object({
        question: z.string().min(3).max(160),
        answer: z.string().min(3).max(1200),
      }),
    )
    .min(1)
    .max(20),
  emit_schema: z.boolean().default(true).describe("Emit FAQPage JSON-LD for rich results"),
});

export default defineBlock({
  type: "faq_accordion",
  label: "FAQ accordion",
  icon: "CircleHelp",
  description: "Questions and answers; auto-emits FAQPage structured data.",
  allowedOn: ["home", "product", "category", "collection", "page", "landing", "custom"],
  schema,
  defaults: {
    title_en: "Frequently asked questions",
    items: [
      { question: "Do you deliver outside Dhaka?", answer: "Yes. 3-5 days to every district, cash on delivery available." },
      { question: "Is the warranty official?", answer: "Every product carries the brand warranty stated on its page and we handle claims for you." },
    ],
    emit_schema: true,
  },
  component: ({ settings }) => {
    const jsonLd = settings.emit_schema
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: settings.items.map((i) => ({ "@type": "Question", name: i.question, acceptedAnswer: { "@type": "Answer", text: i.answer } })),
        }
      : null;
    return (
      <div className="mx-auto max-w-2xl">
        {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
        <h2 className="mb-3 text-xl font-semibold sm:text-2xl">{settings.title_en}</h2>
        <div className="divide-y rounded-2xl border">
          {settings.items.map((i, k) => (
            <details key={k} className="group px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                {i.question}
                <span className="text-muted-foreground transition group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{i.answer}</p>
            </details>
          ))}
        </div>
      </div>
    );
  },
});
