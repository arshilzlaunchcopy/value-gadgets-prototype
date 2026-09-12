import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LAST_ORDER_COOKIE } from "@/lib/checkout/schema";
import { OrderTimeline, statusLabel } from "@/components/store/order-timeline";
import { Button } from "@/components/ui/button";
import { getCurrentCustomer } from "@/lib/auth/session";
import { formatBDT } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { PayNowButton, ProfileForm } from "./client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Order confirmation", robots: { index: false } };

type Props = { params: Promise<{ number: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Display-only. Payment state is read from the database, never from the URL
 * (BUILD_PROMPT §9.5). Guest access via the httpOnly last-order cookie set at
 * placement; otherwise the signed-in customer must own the order.
 */
export default async function ConfirmationPage({ params, searchParams }: Props) {
  const [{ number }, sp, customer, store] = await Promise.all([params, searchParams, getCurrentCustomer(), cookies()]);
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("*, order_items(product_title, variant_label, quantity, unit_price_bdt, line_total_bdt, image_url), order_events(event_type, to_status, note, created_at)")
    .eq("order_number", number.toUpperCase())
    .maybeSingle();
  if (!order) notFound();
  const owns = (customer && order.customer_id === customer.id) || store.get(LAST_ORDER_COOKIE)?.value === order.id;
  if (!owns) notFound();

  const addr = (order.shipping_address ?? {}) as Record<string, string>;
  const payment = typeof sp.payment === "string" ? sp.payment : null;
  const paid = order.payment_status === "paid";
  const pendingOnline = order.payment_method === "sslcommerz" && !paid && order.status === "pending_payment";
  const items = order.order_items ?? [];
  const events = [...(order.order_events ?? [])].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  const missingProfile = customer && (!customer.full_name || !customer.email);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="bg-paper rounded-2xl border p-6 text-center">
        <p className="text-amber-deep text-xs font-semibold tracking-wide uppercase">{pendingOnline ? "Payment pending" : "Thank you"}</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Order {order.order_number}</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {order.status === "awaiting_advance"
            ? "We will call you shortly to confirm this order and take a small advance before dispatch."
            : pendingOnline
              ? payment === "failed" || payment === "cancelled"
                ? "The payment did not go through. You can try again below."
                : "Complete the payment to confirm your order."
              : `We will deliver to ${addr.district}. You will get an SMS at every step.`}
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs">
          <span className="bg-muted rounded-lg px-2 py-1">Status: {statusLabel(order.status)}</span>
          <span className={`rounded-lg px-2 py-1 ${paid ? "bg-success/15 text-success-deep" : "bg-muted"}`}>Payment: {order.payment_status}</span>
          <span className="bg-muted rounded-lg px-2 py-1">{order.payment_method === "cod" ? "Cash on delivery" : "Online"}</span>
        </div>
        {pendingOnline && <PayNowButton orderNumber={order.order_number} />}
      </header>

      <section className="bg-paper rounded-2xl border p-4 sm:p-6">
        <h2 className="mb-4 font-semibold">Progress</h2>
        <OrderTimeline status={order.status} events={events} />
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="bg-paper rounded-2xl border p-4 sm:p-6">
          <h2 className="mb-3 font-semibold">Items</h2>
          <ul className="divide-y text-sm">
            {items.map((it, i) => (
              <li key={i} className="flex items-center gap-3 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- snapshot thumbnail */}
                {it.image_url ? <img src={it.image_url} alt="" width={40} height={40} className="size-10 rounded-lg object-cover" /> : <span className="bg-paper-line size-10 rounded-lg" />}
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1">{it.product_title}</span>
                  <span className="text-muted-foreground text-xs">
                    {it.variant_label ? `${it.variant_label} · ` : ""}× {it.quantity}
                  </span>
                </span>
                <span className="price text-xs">{formatBDT(it.line_total_bdt)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatBDT(order.subtotal_bdt)}</dd></div>
            {order.discount_bdt > 0 && <div className="text-success-deep flex justify-between"><dt>Discount {order.coupon_code ? `(${order.coupon_code})` : ""}</dt><dd>-{formatBDT(order.discount_bdt)}</dd></div>}
            <div className="flex justify-between"><dt>Delivery</dt><dd>{order.shipping_bdt === 0 ? "Free" : formatBDT(order.shipping_bdt)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>Total</dt><dd className="price">{formatBDT(order.total_bdt)}</dd></div>
          </dl>
        </section>
        <section className="bg-paper rounded-2xl border p-4 text-sm sm:p-6">
          <h2 className="mb-3 font-semibold">Delivery address</h2>
          <p className="font-medium">{addr.recipient_name}</p>
          <p>{addr.phone}</p>
          <p>{[addr.street_address, addr.area, addr.upazila, addr.district, addr.division].filter(Boolean).join(", ")}</p>
          {addr.landmark && <p className="text-muted-foreground">{addr.landmark}</p>}
          {order.customer_note && <p className="text-muted-foreground mt-2">Note: {order.customer_note}</p>}
        </section>
      </div>

      {missingProfile && (
        <section className="bg-paper rounded-2xl border p-4 sm:p-6">
          <h2 className="font-semibold">Want order updates by email too?</h2>
          <p className="text-muted-foreground mb-3 text-sm">Optional. One field at a time; you can skip this.</p>
          <ProfileForm hasName={Boolean(customer?.full_name)} hasEmail={Boolean(customer?.email)} />
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Button asChild className="rounded-2xl"><Link href="/">Continue shopping</Link></Button>
        <Button asChild variant="outline" className="rounded-2xl"><Link href={`/track?order=${order.order_number}`}>Track this order</Link></Button>
      </div>
    </div>
  );
}
