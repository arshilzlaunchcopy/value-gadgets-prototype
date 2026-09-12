import { z } from "zod";
import { defineBlock } from "../define";

const schema = z.object({
  stats: z
    .array(
      z.object({
        value: z.string().min(1).max(16),
        label_en: z.string().min(1).max(60),
        label_bn: z.string().max(60).optional().or(z.literal("")),
      }),
    )
    .min(2)
    .max(5),
  style: z.enum(["light", "dark"]).default("light"),
});

export default defineBlock({
  type: "stats_row",
  label: "Stats row",
  icon: "BarChart3",
  description: "Big numbers: orders delivered, districts covered, rating.",
  allowedOn: ["home", "page", "landing", "custom"],
  schema,
  defaults: {
    stats: [
      { value: "12,000+", label_en: "Orders delivered", label_bn: "অর্ডার ডেলিভারি" },
      { value: "64", label_en: "Districts covered", label_bn: "জেলায় ডেলিভারি" },
      { value: "4.8/5", label_en: "Average rating", label_bn: "গড় রেটিং" },
      { value: "24h", label_en: "Warranty claim response", label_bn: "ওয়ারেন্টি রেসপন্স" },
    ],
    style: "light",
  },
  component: ({ settings, locale }) => (
    <ul className={`grid grid-cols-2 gap-3 rounded-2xl p-4 sm:grid-cols-4 ${settings.style === "dark" ? "bg-ink text-paper" : "bg-paper border"}`}>
      {settings.stats.map((s, i) => (
        <li key={i} className="p-2 text-center">
          <p className={`text-3xl font-black tabular-nums ${settings.style === "dark" ? "text-amber" : ""}`}>{s.value}</p>
          <p className={`text-xs ${settings.style === "dark" ? "text-paper/70" : "text-muted-foreground"}`} lang={locale === "bn" && s.label_bn ? "bn" : undefined}>{(locale === "bn" && s.label_bn) || s.label_en}</p>
        </li>
      ))}
    </ul>
  ),
});
