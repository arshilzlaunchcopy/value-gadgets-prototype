import "server-only";

import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

export interface LandingPagePublic {
  id: string;
  slug: string;
  title: string;
  product_id: string | null;
  chrome: "none" | "minimal";
  otp_mode: "never" | "always" | "above_threshold";
  otp_threshold_bdt: number;
  pixel_event: string | null;
  ab_enabled: boolean;
  variant_b_id: string;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  updated_at: string;
}

export const LANDING_TAG = "landing";

/** Published landing page by slug (anon client: RLS only exposes published rows). */
export const getLandingPage = unstable_cache(
  async (slug: string): Promise<LandingPagePublic | null> => {
    const { data } = await createPublicClient()
      .from("landing_pages")
      .select("id, slug, title, product_id, chrome, otp_mode, otp_threshold_bdt, pixel_event, ab_enabled, variant_b_id, meta_title, meta_description, og_image_url, updated_at")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    return (data as LandingPagePublic | null) ?? null;
  },
  ["landing-page"],
  { revalidate: 3600, tags: [LANDING_TAG] },
);

export const getPublishedLandingSlugs = unstable_cache(
  async (): Promise<{ slug: string; updated_at: string }[]> => {
    const { data } = await createPublicClient().from("landing_pages").select("slug, updated_at").eq("status", "published");
    return (data ?? []) as { slug: string; updated_at: string }[];
  },
  ["landing-slugs"],
  { revalidate: 3600, tags: [LANDING_TAG] },
);

/** Per-landing-page OTP rule (PART2 §15.2): never / always / only above a price threshold. */
export function landingRequiresOtp(lp: Pick<LandingPagePublic, "otp_mode" | "otp_threshold_bdt">, orderTotalBdt: number): boolean {
  if (lp.otp_mode === "never") return false;
  if (lp.otp_mode === "always") return true;
  return orderTotalBdt >= lp.otp_threshold_bdt;
}

export type AbVariant = "a" | "b";
export const abCookieName = (slug: string) => `vg_ab_${slug.replace(/[^a-z0-9-]/gi, "")}`;
