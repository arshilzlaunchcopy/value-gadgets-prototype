import { z } from "zod";
import { defineBlock } from "../define";

const schema = z.object({
  big_value: z.string().min(1).max(12).describe('The headline number, e.g. "8-in-1"'),
  big_label_en: z.string().min(1).max(60),
  big_label_bn: z.string().max(60).optional().or(z.literal("")),
  items: z
    .array(
      z.object({
        value: z.string().min(1).max(20),
        label_en: z.string().min(1).max(60),
        label_bn: z.string().max(60).optional().or(z.literal("")),
      }),
    )
    .min(2)
    .max(8),
  style: z.enum(["dark", "light"]).default("dark"),
});

/** The "8-in-1" style callout grid from gadget ad creatives (PART2 §13.2). */
export default defineBlock({
  type: "spec_highlight",
  label: "Spec highlight",
  icon: "Hash",
  description: "Big headline number with a grid of key specs.",
  allowedOn: ["home", "product", "page", "landing", "custom"],
  schema,
  defaults: {
    big_value: "8-in-1",
    big_label_en: "Every port you need from one USB-C cable",
    big_label_bn: "",
    items: [
      { value: "4K@60Hz", label_en: "HDMI output" },
      { value: "100W", label_en: "Pass-through charging" },
      { value: "1 Gbps", label_en: "Ethernet" },
      { value: "10 Gbps", label_en: "USB-A / USB-C data" },
      { value: "SD + TF", label_en: "Card readers" },
      { value: "Aluminium", label_en: "Heat-dissipating shell" },
    ],
    style: "dark",
  },
  component: ({ settings, locale }) => {
    const dark = settings.style === "dark";
    const bigLabel = (locale === "bn" && settings.big_label_bn) || settings.big_label_en;
    return (
      <div className={`grid gap-6 rounded-2xl p-6 sm:grid-cols-[auto_1fr] sm:items-center sm:p-8 ${dark ? "bg-ink text-paper" : "bg-paper border"}`}>
        <div className="text-center sm:text-left">
          <p className={`text-5xl font-black tracking-tight sm:text-6xl ${dark ? "text-amber" : "text-ink"}`}>{settings.big_value}</p>
          <p className={`mt-1 max-w-xs text-sm ${dark ? "text-paper/80" : "text-muted-foreground"}`}>{bigLabel}</p>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {settings.items.map((it, i) => (
            <li key={i} className={`rounded-xl p-3 ${dark ? "bg-paper/10" : "bg-paper-soft"}`}>
              <p className="text-lg font-bold tabular-nums">{it.value}</p>
              <p className={`text-xs ${dark ? "text-paper/70" : "text-muted-foreground"}`}>{(locale === "bn" && it.label_bn) || it.label_en}</p>
            </li>
          ))}
        </ul>
      </div>
    );
  },
});
