import { z } from "zod";
import { defineBlock } from "../define";

const schema = z.object({
  html: z.string().max(20000).describe("Raw HTML. Rendered as-is: only owners may edit this block."),
  container: z.boolean().default(true).describe("Constrain to the page width"),
});

/**
 * html_raw is owner-only (PART2 §13.2): the registry hides it from other roles
 * and the page actions refuse to save it for them. It is still sanitised of
 * nothing on purpose (embeds, widgets), which is exactly why the role gate exists.
 */
export default defineBlock({
  type: "html_raw",
  label: "Raw HTML (owner)",
  icon: "Code",
  description: "Embed codes and custom markup. Owner role only.",
  allowedOn: ["home", "product", "category", "collection", "page", "landing", "custom"],
  minRole: "owner",
  schema,
  defaults: { html: "<div class=\"rounded-2xl border p-6 text-center\">Custom HTML</div>", container: true },
  component: ({ settings }) => <div className={settings.container ? "mx-auto max-w-6xl" : ""} dangerouslySetInnerHTML={{ __html: settings.html }} />,
});
