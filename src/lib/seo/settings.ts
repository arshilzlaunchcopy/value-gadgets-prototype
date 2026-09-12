import { unstable_cache } from "next/cache";
import { z } from "zod";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Site-wide SEO defaults and title templates (BUILD_PROMPT §7.2, §7.8, §7.10).
 * Stored as the public settings key "seo"; `{title}`, `{name}` and `{store}`
 * are the template placeholders.
 */
export const seoSettingsSchema = z.object({
  title_template_product: z.string().max(120).default("{title} — Price in Bangladesh | {store}"),
  title_template_category: z.string().max(120).default("{name} — Buy Online in Bangladesh | {store}"),
  title_template_collection: z.string().max(120).default("{name} | {store}"),
  title_template_post: z.string().max(120).default("{title} | {store} Blog"),
  title_template_page: z.string().max(120).default("{title} | {store}"),
  home_title: z.string().max(120).default(""),
  default_description: z.string().max(320).default(""),
  default_og_image: z.string().max(500).default(""),
  gsc_verification: z.string().max(200).default(""),
  ga4_id: z.string().max(40).default(""),
  meta_pixel_id: z.string().max(40).default(""),
  meta_capi_token: z.string().max(400).default(""),
  index_site: z.boolean().default(true),
});
export type SeoSettings = z.output<typeof seoSettingsSchema>;
export const SEO_TAG = "seo";

export const getSeoSettings = unstable_cache(
  async (): Promise<SeoSettings> => {
    const { data } = await createPublicClient().from("settings").select("value").eq("key", "seo").eq("is_public", true).maybeSingle();
    const parsed = seoSettingsSchema.safeParse(data?.value ?? {});
    return parsed.success ? parsed.data : seoSettingsSchema.parse({});
  },
  ["seo-settings"],
  { revalidate: 3600, tags: [SEO_TAG, "settings"] },
);

export function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "").replace(/\s{2,}/g, " ").trim();
}
