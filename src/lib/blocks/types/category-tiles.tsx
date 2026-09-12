import Link from "next/link";
import { z } from "zod";
import { getNavCategories, type CategorySummary } from "@/lib/catalog/queries";
import { defineBlock } from "../define";

const schema = z.object({
  title_en: z.string().max(80).optional().or(z.literal("")),
  only_top_level: z.boolean().default(true),
  style: z.enum(["pills", "cards"]).default("pills"),
});

export default defineBlock<typeof schema, CategorySummary[]>({
  type: "category_tiles",
  label: "Category tiles",
  icon: "Grid3x3",
  description: "Links to every active category.",
  allowedOn: ["home", "custom", "landing", "page"],
  schema,
  defaults: { title_en: "", only_top_level: true, style: "pills" },
  loader: async (s) => (await getNavCategories()).filter((c) => !s.only_top_level || !c.parent_id),
  component: ({ settings, data, locale }) => (
    <div>
      {settings.title_en ? <h2 className="mb-4 text-xl font-semibold sm:text-2xl">{settings.title_en}</h2> : <h2 className="sr-only">Categories</h2>}
      <ul className={`grid gap-3 ${settings.style === "cards" ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-7"}`}>
        {(data ?? []).map((c) => (
          <li key={c.id}>
            <Link href={`/category/${c.slug}`} className={`bg-paper hover:ring-amber block rounded-2xl border text-center font-medium ring-2 ring-transparent transition ${settings.style === "cards" ? "p-6 text-base" : "p-3 text-sm"}`}>
              {(locale === "bn" && c.name_bn) || c.name_en}
              {settings.style === "cards" && locale === "en" && c.name_bn && (
                <span lang="bn" className="text-muted-foreground mt-1 block text-xs font-normal">
                  {c.name_bn}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  ),
});
