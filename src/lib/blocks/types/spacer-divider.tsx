import { z } from "zod";
import { defineBlock } from "../define";

/**
 * Ninth block, added as ONE file to prove the §13.1 rule: nothing else changed
 * for it to appear in the palette, validate, render and get an admin form.
 */
const schema = z.object({
  height: z.enum(["small", "medium", "large"]).default("medium"),
  show_line: z.boolean().default(false).describe("Draw a thin divider line"),
});

export default defineBlock({
  type: "spacer_divider",
  label: "Spacer / divider",
  icon: "Minus",
  description: "Vertical breathing room, optionally with a line.",
  allowedOn: ["home", "product", "category", "collection", "page", "landing", "custom"],
  schema,
  defaults: { height: "medium", show_line: false },
  component: ({ settings }) => {
    const h = { small: "h-4", medium: "h-10", large: "h-20" }[settings.height];
    return <div className={`${h} flex items-center`} aria-hidden="true">{settings.show_line && <hr className="border-paper-line w-full" />}</div>;
  },
});
