import { z } from "zod";
import { TrustStrip } from "@/components/store/trust-strip";
import { defineBlock } from "../define";

const schema = z.object({
  badges: z
    .array(
      z.object({
        icon: z.enum(["shield-check", "truck", "badge-check", "rotate-ccw"]).default("shield-check"),
        title: z.string().min(1).max(40),
        text: z.string().max(80).optional().or(z.literal("")),
      }),
    )
    .min(2)
    .max(4),
});

export default defineBlock({
  type: "trust_badges",
  label: "Trust badges",
  icon: "ShieldCheck",
  description: "Warranty, delivery, genuine product, easy return - the strip that converts in Bangladesh.",
  allowedOn: ["home", "product", "category", "collection", "page", "landing", "custom"],
  schema,
  defaults: {
    badges: [
      { icon: "shield-check", title: "Official warranty", text: "6 to 24 months on every product" },
      { icon: "truck", title: "Fast delivery", text: "1-2 days in Dhaka, 3-5 nationwide" },
      { icon: "badge-check", title: "Verified seller", text: "Trade licensed, genuine stock" },
      { icon: "rotate-ccw", title: "Easy returns", text: "7-day replacement on faults" },
    ],
  },
  component: ({ settings }) => <TrustStrip badges={settings.badges.map((b) => ({ icon: b.icon, title: b.title, text: b.text ?? "" }))} />,
});
