import type { Metadata } from "next";
import Link from "next/link";
import { AccountLogin, SignOutButton } from "@/components/store/account-client";
import { getCurrentCustomer } from "@/lib/auth/session";
import { formatDateLocale } from "@/lib/i18n/format";
import { localeContext } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const L = await localeContext((await params).locale);
  return { title: L.t("account.title"), robots: { index: false } };
}

/**
 * Reachable, never forced (BUILD_PROMPT §6.1). Signed-in reads go through the
 * cookie-bound client, so RLS (orders: self select, addresses: self all) is exercised.
 */
export default async function AccountPage({ params }: Props) {
  const [L, customer] = await Promise.all([localeContext((await params).locale), getCurrentCustomer()]);
  const { t } = L;
  if (!customer) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="mb-2 text-2xl font-semibold sm:text-3xl">{t("account.title")}</h1>
        <p className="text-muted-foreground mb-6 text-sm">{t("account.hint")}</p>
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
          <h1 className="text-2xl font-semibold sm:text-3xl">{customer.full_name ?? t("account.title")}</h1>
          <p className="text-muted-foreground text-sm">
            {customer.phone}
            {customer.email ? ` · ${customer.email}` : ""}
          </p>
        </div>
        <SignOutButton />
      </header>

      <section className="bg-paper rounded-2xl border p-4 sm:p-6">
        <h2 className="mb-3 font-semibold">{t("account.orders")}</h2>
        {!orders?.length ? (
          <p className="text-muted-foreground text-sm">{t("account.no_orders")}</p>
        ) : (
          <ul className="divide-y text-sm">
            {orders.map((o) => (
              <li key={o.order_number} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/order/${o.order_number}/confirmation`} className="font-medium hover:underline">
                  {o.order_number}
                </Link>
                <span className="text-muted-foreground text-xs">{formatDateLocale(o.placed_at, L.locale)}</span>
                <span className="bg-muted rounded-lg px-2 py-0.5 text-xs">{t(`status.${o.status}` as never)}</span>
                <span className="price">{L.money(o.total_bdt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-paper rounded-2xl border p-4 sm:p-6">
        <h2 className="mb-3 font-semibold">{t("account.addresses")}</h2>
        {!addresses?.length ? (
          <p className="text-muted-foreground text-sm">—</p>
        ) : (
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {addresses.map((a) => (
              <li key={a.id} className="rounded-lg border p-3">
                <p className="font-medium">{a.recipient_name}</p>
                <p className="text-muted-foreground">{[a.street_address, a.upazila, a.district, a.division].filter(Boolean).join(", ")}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
