import { Send } from "lucide-react";
import { z } from "zod";
import { getStoreSettings } from "@/lib/settings";
import { defineBlock } from "../define";

const schema = z.object({
  page_username: z.string().max(80).optional().or(z.literal("")).describe("Facebook page username (m.me/<username>); blank = from the store Facebook URL"),
  label_en: z.string().max(40).default("Message us on Messenger"),
  label_bn: z.string().max(40).optional().or(z.literal("")),
  style: z.enum(["floating", "inline"]).default("inline"),
});

function usernameFromFacebookUrl(url: string): string {
  try {
    return new URL(url).pathname.split("/").filter(Boolean)[0] ?? "";
  } catch {
    return "";
  }
}

export default defineBlock<typeof schema, string>({
  type: "messenger_cta",
  label: "Messenger button",
  icon: "Send",
  description: "Opens the store's Facebook Messenger conversation.",
  allowedOn: ["home", "product", "category", "collection", "page", "landing", "custom"],
  schema,
  defaults: { page_username: "", label_en: "Message us on Messenger", style: "inline" },
  loader: async (s) => s.page_username || usernameFromFacebookUrl((await getStoreSettings()).facebook),
  component: ({ settings, data, locale }) => {
    if (!data) return null;
    const href = `https://m.me/${data}`;
    const label = (locale === "bn" && settings.label_bn) || settings.label_en;
    if (settings.style === "floating") {
      return (
        <a href={href} target="_blank" rel="noopener" aria-label={label} className="text-paper fixed right-4 bottom-36 z-30 flex size-14 items-center justify-center rounded-full bg-[#0084FF] shadow-lg lg:bottom-24">
          <Send className="size-6" />
        </a>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener" className="text-paper flex items-center justify-center gap-2 rounded-2xl bg-[#0084FF] px-5 py-4 text-base font-semibold hover:opacity-90">
        <Send className="size-5" />
        {label}
      </a>
    );
  },
});
