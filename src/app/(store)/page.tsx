import { HomeFallback } from "@/components/store/home-fallback";
import { BlockRenderer } from "@/lib/blocks/render";
import { getStoreSettings } from "@/lib/settings";

export const revalidate = 3600;

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
