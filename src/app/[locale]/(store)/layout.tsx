import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnalyticsScripts } from "@/components/analytics/scripts";
import { JsonLd } from "@/components/seo/json-ld";
import { Footer } from "@/components/store/footer";
import { Header } from "@/components/store/header";
import { CartProvider } from "@/components/store/cart/cart-provider";
import { CartDrawer } from "@/components/store/cart/cart-drawer";
import { getNavCategories } from "@/lib/catalog/queries";
import { getFooterPages } from "@/lib/content/queries";
import { publicEnv } from "@/lib/env.public";
import { isLocale, LOCALES } from "@/lib/i18n/messages";
import { LocaleProvider } from "@/lib/i18n/provider";
import { localeContext } from "@/lib/i18n/server";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";
import { getSeoSettings } from "@/lib/seo/settings";
import { getStoreSettings } from "@/lib/settings";
import { getMenus, getTheme } from "@/lib/theme/get";

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const [store, seo] = await Promise.all([getStoreSettings(), getSeoSettings()]);
  return {
    metadataBase: new URL(publicEnv.siteUrl),
    title: { default: seo.home_title || `${store.name} - ${store.tagline}`, template: `%s | ${store.name}` },
    description: seo.default_description || store.tagline,
    openGraph: { siteName: store.name, type: "website", locale: locale === "bn" ? "bn_BD" : "en_BD", images: seo.default_og_image ? [{ url: seo.default_og_image }] : undefined },
    alternates: { canonical: locale === "bn" ? "/bn" : "/", languages: { en: "/", bn: "/bn", "x-default": "/" } },
    robots: seo.index_site ? undefined : { index: false, follow: false },
    verification: seo.gsc_verification ? { google: seo.gsc_verification } : undefined,
  };
}

/** Storefront shell: theme-driven header/footer (PART2 §13.4-13.5), cart drawer, locale context (PART2 §15.3). */
export default async function StoreLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [store, categories, theme, menus, pages, L] = await Promise.all([getStoreSettings(), getNavCategories(), getTheme(), getMenus(), getFooterPages(), localeContext(locale)]);
  return (
    <LocaleProvider locale={L.locale} banglaNumerals={L.banglaNumerals}>
      <CartProvider>
        <JsonLd data={[organizationJsonLd(store), websiteJsonLd(store)]} />
        <AnalyticsScripts />
        <div lang={L.locale} className="contents">
          <Header store={store} categories={categories} header={theme.header} announcement={theme.announcement} mainMenu={menus.main} mobileMenu={menus.mobile} locale={L.locale} showSwitcher={L.showSwitcher || theme.header.show_language_switcher} />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
          <Footer store={store} categories={categories} footer={theme.footer} menus={menus} pages={pages} locale={L.locale} />
        </div>
        <CartDrawer />
      </CartProvider>
    </LocaleProvider>
  );
}
