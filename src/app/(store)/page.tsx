import type { Metadata } from "next";
import { HomeFallback } from "@/components/store/home-fallback";
import { BlockRenderer } from "@/lib/blocks/render";
import { buildMetadata } from "@/lib/seo/metadata";
import { getStoreSettings } from "@/lib/settings";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStoreSettings();
  return buildMetadata({ entityType: "home", entityId: null, path: "/", templateVars: { title: store.name }, fallbackDescription: store.tagline });
}

/** Home page = published blocks for page_type "home" (PART2 §13); fallback when none. */
export default async function HomePage() {
  const store = await getStoreSettings();
  return (
    <>
      <h1 className="sr-only">{store.name}</h1>
      <BlockRenderer pageType="home" fallback={<HomeFallback />} />
    </>
  );
}
