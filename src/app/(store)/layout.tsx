import type { Metadata } from "next";
import { Footer } from "@/components/store/footer";
import { Header } from "@/components/store/header";
import { CartProvider } from "@/components/store/cart/cart-provider";
import { CartDrawer } from "@/components/store/cart/cart-drawer";
import { getNavCategories } from "@/lib/catalog/queries";
import { publicEnv } from "@/lib/env.public";
import { getStoreSettings } from "@/lib/settings";
import { getMenus, getTheme } from "@/lib/theme/get";

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

/** Storefront shell: theme-driven header/footer (PART2 §13.4-13.5), cart drawer mounted once. */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [store, categories, theme, menus] = await Promise.all([getStoreSettings(), getNavCategories(), getTheme(), getMenus()]);
  return (
    <CartProvider>
      <Header store={store} categories={categories} header={theme.header} announcement={theme.announcement} mainMenu={menus.main} mobileMenu={menus.mobile} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <Footer store={store} categories={categories} footer={theme.footer} menus={menus} />
      <CartDrawer />
    </CartProvider>
  );
}
