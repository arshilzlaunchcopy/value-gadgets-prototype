import type { Metadata } from "next";
import { CartPageClient } from "@/components/store/cart/cart-page-client";
import { getCartSummary } from "@/lib/cart/queries";
import { getCartId } from "@/lib/cart/session";
import { localeContext } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const L = await localeContext((await params).locale);
  return { title: L.t("cart.title"), robots: { index: false } };
}

export default async function CartPage({ params }: Props) {
  const [cart, L] = await Promise.all([getCartSummary(await getCartId()), localeContext((await params).locale)]);
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold sm:text-3xl">{L.t("cart.title")}</h1>
      <CartPageClient initial={cart} />
    </>
  );
}
