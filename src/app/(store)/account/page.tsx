import type { Metadata } from "next";
import Link from "next/link";
import { AccountLogin, SignOutButton } from "@/components/store/account-client";
import { statusLabel } from "@/components/store/order-timeline";
import { getCurrentCustomer } from "@/lib/auth/session";
import { formatBDT, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your account", robots: { index: false } };

/**
 * Reachable, never forced (BUILD_PROMPT §6.1). Signed-in reads go through the
 * cookie-bound client, so RLS (orders: self select, addresses: self all) is exercised.
 */
export default async function AccountPage() {
  const customer = await getCurrentCustomer();
  if (!customer) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="mb-2 text-2xl font-semibold sm:text-3xl">Your account</h1>
        <p className="text-muted-foreground mb-6 text-sm">Sign in with your mobile number to see your orders and addresses.</p>
        <div className="bg-paper rounded-2xl border p-4 sm:p-6">
          <AccountLogin />
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: orders }, { data: addresses }] = await Promise.all([
    supabase.from("orders").select("order_number, status, payment_status, total_bdt, placed_at").eq("customer_id", customer.id).order("placed_at", { ascending: false }).limit(20),
    supabase.from("addresses").select("id, recipient_name, street_address, upazila, district, division, is_default").eq("customer_id", customer.id).order("is_default", { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">{customer.full_name ?? "Your account"}</h1>
          <p className="text-muted-foreground text-sm">
            {customer.phone}
            {customer.email ? ` · ${customer.email}` : ""}
          </p>
        </div>
        <SignOutButton />
      </header>

      <section className="bg-paper rounded-2xl border p-4 sm:p-6">
        <h2 className="mb-3 font-semibold">Orders</h2>
        {!orders?.length ? (
          <p className="text-muted-foreground text-sm">No orders yet.</p>
        ) : (
          <ul className="divide-y text-sm">
            {orders.map((o) => (
              <li key={o.order_number} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/order/${o.order_number}/confirmation`} className="font-medium hover:underline">
                  {o.order_number}
                </Link>
                <span className="text-muted-foreground text-xs">{formatDate(o.placed_at)}</span>
                <span className="bg-muted rounded-lg px-2 py-0.5 text-xs">{statusLabel(o.status)}</span>
                <span className="price">{formatBDT(o.total_bdt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-paper rounded-2xl border p-4 sm:p-6">
        <h2 className="mb-3 font-semibold">Addresses</h2>
        {!addresses?.length ? (
          <p className="text-muted-foreground text-sm">No saved addresses yet.</p>
        ) : (
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {addresses.map((a) => (
              <li key={a.id} className="rounded-lg border p-3">
                <p className="font-medium">
                  {a.recipient_name} {a.is_default && <span className="bg-amber/20 ml-1 rounded px-1 text-xs">default</span>}
                </p>
                <p className="text-muted-foreground">{[a.street_address, a.upazila, a.district, a.division].filter(Boolean).join(", ")}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
