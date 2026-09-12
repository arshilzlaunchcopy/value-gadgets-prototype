import { cookies } from "next/headers";
import { CartDrawer } from "@/components/store/cart/cart-drawer";
import { CartProvider } from "@/components/store/cart/cart-provider";
import { LOCALE_COOKIE } from "@/lib/i18n/messages";
import { LocaleProvider } from "@/lib/i18n/provider";
import { localeContext } from "@/lib/i18n/server";

/**
 * Landing pages (PART2 §15.2): no storefront header/footer. Each page decides
 * whether to show the minimal chrome bar. Cart context is still mounted so
 * commerce blocks (featured product, carousels) keep working.
 */
export default async function LandingLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const L = await localeContext(jar.get(LOCALE_COOKIE)?.value ?? "en");
  return (
    <LocaleProvider locale={L.locale} banglaNumerals={L.banglaNumerals}>
      <CartProvider>
        <div lang={L.locale} className="contents">{children}</div>
        <CartDrawer />
      </CartProvider>
    </LocaleProvider>
  );
}
