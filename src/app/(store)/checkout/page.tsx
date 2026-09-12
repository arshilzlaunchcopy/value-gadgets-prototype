import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/store/checkout/checkout-form";
import { getCurrentCustomer } from "@/lib/auth/session";
import { getCartSummary } from "@/lib/cart/queries";
import { reserveCart } from "@/lib/cart/reservations";
import { getCartId } from "@/lib/cart/session";
import { getPublicSettings } from "@/lib/settings";
import { savedAddresses } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const cartId = await getCartId();
  const cart = await getCartSummary(cartId);
  if (!cartId || cart.items.length === 0) redirect("/cart");

  const [customer, settings, reservation] = await Promise.all([getCurrentCustomer(), getPublicSettings(), reserveCart(cartId)]);
  const addresses = customer ? await savedAddresses(customer.id) : [];

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold sm:text-3xl">Checkout</h1>
      <CheckoutForm initialCart={cart} customer={customer} savedAddresses={addresses} reservationProblems={reservation.problems} codAvailable={settings.delivery.cod_available} />
    </>
  );
}
