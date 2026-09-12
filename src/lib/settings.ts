import { unstable_cache } from "next/cache";
import { z } from "zod";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Store settings (CLAUDE.md rule 9: brand values come from the DB at runtime).
 * Public keys are read with the anon client and cached under the "settings" tag.
 * Defaults keep the storefront rendering before the seed has run.
 */
export const storeSettingsSchema = z.object({
  name: z.string().default("Store"),
  tagline: z.string().default("Genuine gadgets, delivered nationwide"),
  phone: z.string().default(""),
  whatsapp: z.string().default(""),
  email: z.string().default(""),
  address: z.string().default(""),
  trade_license: z.string().default(""),
  tin: z.string().default(""),
  facebook: z.string().default(""),
  instagram: z.string().default(""),
  youtube: z.string().default(""),
  currency: z.string().default("BDT"),
});
export type StoreSettings = z.infer<typeof storeSettingsSchema>;

export const heroSettingsSchema = z.object({
  heading: z.string().default("Genuine tech accessories, delivered anywhere in Bangladesh"),
  subheading: z.string().default("Hubs, cables, chargers, audio and smart-home gadgets with real warranty."),
  cta_label: z.string().default("Shop offers"),
  cta_href: z.string().default("/collection/eid-offers"),
  secondary_label: z.string().default("New arrivals"),
  secondary_href: z.string().default("/collection/new-arrivals"),
});
export type HeroSettings = z.infer<typeof heroSettingsSchema>;

export const trustBadgeSchema = z.object({ icon: z.string(), title: z.string(), text: z.string() });
export type TrustBadge = z.infer<typeof trustBadgeSchema>;

export const deliverySettingsSchema = z.object({
  return_days: z.number().int().default(7),
  cod_available: z.boolean().default(true),
});
export type DeliverySettings = z.infer<typeof deliverySettingsSchema>;

export interface PublicSettings {
  store: StoreSettings;
  hero: HeroSettings;
  trust_badges: TrustBadge[];
  delivery: DeliverySettings;
}

const DEFAULT_BADGES: TrustBadge[] = [
  { icon: "shield-check", title: "Official warranty", text: "6 to 24 months on every product" },
  { icon: "truck", title: "Fast delivery", text: "1-2 days in Dhaka, 3-5 nationwide" },
  { icon: "badge-check", title: "Verified seller", text: "Trade licensed, genuine stock" },
  { icon: "rotate-ccw", title: "Easy returns", text: "7-day replacement on faults" },
];

async function loadPublicSettings(): Promise<PublicSettings> {
  const { data } = await createPublicClient().from("settings").select("key, value").eq("is_public", true);
  const map = new Map((data ?? []).map((r) => [r.key, r.value]));
  const badges = z.array(trustBadgeSchema).safeParse(map.get("trust_badges"));
  return {
    store: storeSettingsSchema.parse(map.get("store") ?? {}),
    hero: heroSettingsSchema.parse(map.get("hero") ?? {}),
    trust_badges: badges.success && badges.data.length ? badges.data : DEFAULT_BADGES,
    delivery: deliverySettingsSchema.parse(map.get("delivery") ?? {}),
  };
}

export const getPublicSettings = unstable_cache(loadPublicSettings, ["public-settings"], {
  revalidate: 3600,
  tags: ["settings"],
});

export async function getStoreSettings(): Promise<StoreSettings> {
  return (await getPublicSettings()).store;
}
