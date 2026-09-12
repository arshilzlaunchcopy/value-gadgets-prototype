import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TrackBeginCheckout } from "@/components/analytics/trackers";
import { CheckoutForm } from "@/components/store/checkout/checkout-form";
import { getCurrentCustomer } from "@/lib/auth/session";
import { getCartSummary } from "@/lib/cart/queries";
import { reserveCart } from "@/lib/cart/reservations";
import { getCartId } from "@/lib/cart/session";
import { localeContext } from "@/lib/i18n/server";
import { getPublicSettings } from "@/lib/settings";
import { savedAddresses } from "./actions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const L = await localeContext((await params).locale);
  return { title: L.t("checkout.title"), robots: { index: false } };
}

export default async function CheckoutPage({ params }: Props) {
  const L = await localeContext((await params).locale);
  const cartId = await getCartId();
  const cart = await getCartSummary(cartId);
  if (!cartId || cart.items.length === 0) redirect("/cart");

  const [customer, settings, reservation] = await Promise.all([getCurrentCustomer(), getPublicSettings(), reserveCart(cartId)]);
  const addresses = customer ? await savedAddresses(customer.id) : [];

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold sm:text-3xl">{L.t("checkout.title")}</h1>
      <TrackBeginCheckout items={cart.items.map((l) => ({ id: l.variant_id, name: l.title, price_bdt: l.unit_price_bdt, quantity: l.quantity, variant: l.variant_label }))} />
      <CheckoutForm initialCart={cart} customer={customer} savedAddresses={addresses} reservationProblems={reservation.problems} codAvailable={settings.delivery.cod_available} />
    </>
  );
}
