import { z } from "zod";
import { RecentlyViewed } from "@/components/store/blocks/recently-viewed";
import { defineBlock } from "../define";

const schema = z.object({
  title_en: z.string().max(80).default("Recently viewed"),
  title_bn: z.string().max(80).optional().or(z.literal("")),
  limit: z.number().int().min(2).max(12).default(6),
});

/**
 * Client island: the list of recently viewed slugs lives in the visitor's
 * localStorage (product browsing history, not the cart - CLAUDE.md rule 7 is
 * about the cart only) and the summaries are fetched from /api/products/summary.
 */
export default defineBlock({
  type: "recently_viewed",
  label: "Recently viewed",
  icon: "History",
  description: "Products this visitor looked at, newest first.",
  allowedOn: ["home", "product", "category", "collection", "page", "custom"],
  schema,
  defaults: { title_en: "Recently viewed", limit: 6 },
  component: ({ settings, locale, targetId }) => <RecentlyViewed title={(locale === "bn" && settings.title_bn) || settings.title_en} limit={settings.limit} excludeProductId={targetId} />,
});
