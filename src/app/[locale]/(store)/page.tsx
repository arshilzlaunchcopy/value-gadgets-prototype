import type { Metadata } from "next";
import { HomeFallback } from "@/components/store/home-fallback";
import { BlockRenderer } from "@/lib/blocks/render";
import { localeContext } from "@/lib/i18n/server";
import { buildMetadata } from "@/lib/seo/metadata";
import { getStoreSettings } from "@/lib/settings";

export const revalidate = 3600;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ locale }, store] = await Promise.all([params, getStoreSettings()]);
  return buildMetadata({ entityType: "home", entityId: null, locale: locale === "bn" ? "bn" : "en", path: "/", templateVars: { title: store.name }, fallbackDescription: store.tagline });
}

/** Home page = published blocks for page_type "home" (PART2 §13); fallback when none. */
export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  const [store, L] = await Promise.all([getStoreSettings(), localeContext(locale)]);
  return (
    <>
      <h1 className="sr-only">{store.name}</h1>
      <BlockRenderer pageType="home" locale={L.locale} fallback={<HomeFallback locale={L.locale} />} />
    </>
  );
}
