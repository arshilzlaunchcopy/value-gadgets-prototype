import type { Metadata } from "next";
import { Footer } from "@/components/store/footer";
import { Header } from "@/components/store/header";
import { CartProvider } from "@/components/store/cart/cart-provider";
import { CartDrawer } from "@/components/store/cart/cart-drawer";
import { getNavCategories } from "@/lib/catalog/queries";
import { publicEnv } from "@/lib/env.public";
import { getStoreSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStoreSettings();
  return {
    metadataBase: new URL(publicEnv.siteUrl),
    title: { default: `${store.name} - ${store.tagline}`, template: `%s | ${store.name}` },
    description: store.tagline,
    openGraph: { siteName: store.name, type: "website", locale: "en_BD" },
    alternates: { canonical: "/" },
  };
}

/** Storefront shell: dark header/footer, light content, cart drawer mounted once. */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [store, categories] = await Promise.all([getStoreSettings(), getNavCategories()]);
  return (
    <CartProvider>
      <Header store={store} categories={categories} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <Footer store={store} categories={categories} />
      <CartDrawer />
    </CartProvider>
  );
}
