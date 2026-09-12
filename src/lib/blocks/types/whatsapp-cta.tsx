import { MessageCircle } from "lucide-react";
import { z } from "zod";
import { getStoreSettings } from "@/lib/settings";
import { defineBlock } from "../define";

const schema = z.object({
  number: z.string().max(20).optional().or(z.literal("")).describe("Blank = store WhatsApp number from settings"),
  message_en: z.string().max(200).default("Hi! I have a question about a product."),
  message_bn: z.string().max(200).optional().or(z.literal("")),
  label_en: z.string().max(40).default("Chat on WhatsApp"),
  label_bn: z.string().max(40).optional().or(z.literal("")),
  style: z.enum(["floating", "inline"]).default("inline"),
});

function waHref(number: string, text: string): string {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

/** WhatsApp is where BD customers actually ask questions (PART2 §15.6). */
export default defineBlock<typeof schema, string>({
  type: "whatsapp_cta",
  label: "WhatsApp button",
  icon: "MessageCircle",
  description: "Inline card or floating bubble that opens a WhatsApp chat.",
  allowedOn: ["home", "product", "category", "collection", "page", "landing", "custom"],
  schema,
  defaults: { number: "", message_en: "Hi! I have a question about a product.", label_en: "Chat on WhatsApp", style: "inline" },
  loader: async (s) => s.number || (await getStoreSettings()).whatsapp,
  component: ({ settings, data, locale }) => {
    const number = data ?? "";
    if (!number) return null;
    const label = (locale === "bn" && settings.label_bn) || settings.label_en;
    const message = (locale === "bn" && settings.message_bn) || settings.message_en;
    const href = waHref(number, message);
    if (settings.style === "floating") {
      return (
        <a href={href} target="_blank" rel="noopener" aria-label={label} className="bg-success text-paper fixed right-4 bottom-20 z-30 flex size-14 items-center justify-center rounded-full shadow-lg lg:bottom-6">
          <MessageCircle className="size-7" />
        </a>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener" className="bg-success text-paper flex items-center justify-center gap-2 rounded-2xl px-5 py-4 text-base font-semibold hover:opacity-90">
        <MessageCircle className="size-5" />
        {label}
      </a>
    );
  },
});
