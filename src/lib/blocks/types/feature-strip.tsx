import { BadgeCheck, Banknote, Headphones, PackageCheck, RotateCcw, ShieldCheck, Smartphone, Truck, Zap, type LucideIcon } from "lucide-react";
import { z } from "zod";
import { defineBlock } from "../define";

const ICONS: Record<string, LucideIcon> = { "shield-check": ShieldCheck, truck: Truck, "badge-check": BadgeCheck, "rotate-ccw": RotateCcw, zap: Zap, banknote: Banknote, headphones: Headphones, "package-check": PackageCheck, smartphone: Smartphone };

const schema = z.object({
  items: z
    .array(
      z.object({
        icon: z.enum(["shield-check", "truck", "badge-check", "rotate-ccw", "zap", "banknote", "headphones", "package-check", "smartphone"]).default("zap"),
        label_en: z.string().min(1).max(40),
        label_bn: z.string().max(40).optional().or(z.literal("")),
      }),
    )
    .min(2)
    .max(6),
  style: z.enum(["light", "dark", "amber"]).default("dark"),
});

/** Icon + label row matching the brand's marketing creative style (PART2 §13.2). */
export default defineBlock({
  type: "feature_strip",
  label: "Feature strip",
  icon: "Zap",
  description: "Compact icon + label row (COD, warranty, fast delivery...).",
  allowedOn: ["home", "product", "category", "collection", "page", "landing", "custom"],
  schema,
  defaults: {
    items: [
      { icon: "banknote", label_en: "Cash on delivery", label_bn: "ক্যাশ অন ডেলিভারি" },
      { icon: "truck", label_en: "1-2 days in Dhaka", label_bn: "ঢাকায় ১-২ দিনে" },
      { icon: "shield-check", label_en: "Official warranty", label_bn: "অফিসিয়াল ওয়ারেন্টি" },
      { icon: "headphones", label_en: "WhatsApp support", label_bn: "হোয়াটসঅ্যাপ সাপোর্ট" },
    ],
    style: "dark",
  },
  component: ({ settings, locale }) => {
    const tone = { light: "bg-paper border", dark: "bg-ink text-paper", amber: "bg-amber text-ink" }[settings.style];
    return (
      <ul className={`grid gap-2 rounded-2xl px-4 py-3 text-sm ${tone}`} style={{ gridTemplateColumns: `repeat(auto-fit, minmax(140px, 1fr))` }}>
        {settings.items.map((it, i) => {
          const Icon = ICONS[it.icon] ?? Zap;
          const label = (locale === "bn" && it.label_bn) || it.label_en;
          return (
            <li key={i} className="flex items-center justify-center gap-2 py-1 font-medium" lang={locale === "bn" && it.label_bn ? "bn" : undefined}>
              <Icon className={`size-4 shrink-0 ${settings.style === "dark" ? "text-amber" : ""}`} />
              {label}
            </li>
          );
        })}
      </ul>
    );
  },
});
