import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getCurrentCustomer } from "@/lib/auth/session";
import { LAST_ORDER_COOKIE } from "@/lib/checkout/schema";
import { formatDateLocale } from "@/lib/i18n/format";
import { localeContext } from "@/lib/i18n/server";
import { getStoreSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { InvoiceToolbar } from "./toolbar";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; number: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, number } = await params;
  const L = await localeContext(locale);
  return { title: `${L.t("misc.invoice_title")} ${number.toUpperCase()}`, robots: { index: false } };
}

/** Customer invoice in the page language (PART2 §15.3, §15.6) with the trade licence number. Print-friendly. */
export default async function InvoicePage({ params }: Props) {
  const { locale, number } = await params;
  const [L, customer, jar, store] = await Promise.all([localeContext(locale), getCurrentCustomer(), cookies(), getStoreSettings()]);
  const { t, money } = L;
  const { data: o } = await createAdminClient()
    .from("orders")
    .select("id, order_number, placed_at, payment_method, payment_status, subtotal_bdt, discount_bdt, shipping_bdt, total_bdt, coupon_code, customer_id, customer_phone, shipping_address, order_items(product_title, variant_label, quantity, unit_price_bdt, line_total_bdt)")
    .eq("order_number", number.toUpperCase())
    .maybeSingle();
  if (!o) notFound();
  const owns = (customer && o.customer_id === customer.id) || jar.get(LAST_ORDER_COOKIE)?.value === o.id;
  if (!owns) notFound();
  const addr = (o.shipping_address ?? {}) as Record<string, string>;

  return (
    <div className="mx-auto max-w-2xl" lang={L.locale}>
      <InvoiceToolbar locale={L.locale} number={o.order_number} />
      <article className="bg-paper rounded-2xl border p-6 print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
          <div>
            <p className="text-xl font-bold">{store.name}</p>
            <p className="text-xs">{store.address}</p>
            <p className="text-xs">{store.phone}{store.email ? ` · ${store.email}` : ""}</p>
            {store.trade_license && <p className="text-xs">{t("misc.trade_licence")}: {store.trade_license}</p>}
            {store.tin && <p className="text-xs">{t("misc.tin")}: {store.tin}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">{t("misc.invoice_title")}</p>
            <p className="font-mono text-sm">{o.order_number}</p>
            <p className="text-xs">{formatDateLocale(o.placed_at, L.locale)}</p>
            <p className="text-xs">{o.payment_method === "cod" ? t("checkout.cod") : t("checkout.online")} · {t(`payment.${o.payment_status}` as never)}</p>
          </div>
        </header>
        <section className="mt-4 text-sm">
          <p className="text-muted-foreground text-xs uppercase">{t("order.address")}</p>
          <p className="font-medium">{addr.recipient_name} · {addr.phone ?? o.customer_phone}</p>
          <p>{[addr.street_address, addr.area, addr.upazila, addr.district, addr.division].filter(Boolean).join(", ")}</p>
        </section>
        <table className="mt-4 w-full text-sm">
          <thead className="border-b text-left text-xs uppercase">
            <tr><th className="py-1">{t("misc.item")}</th><th className="py-1 text-right">{t("misc.qty")}</th><th className="py-1 text-right">{t("misc.unit")}</th><th className="py-1 text-right">{t("checkout.total")}</th></tr>
          </thead>
          <tbody>
            {(o.order_items ?? []).map((it, i) => (
              <tr key={i} className="border-b">
                <td className="py-1.5">{it.product_title}{it.variant_label ? ` · ${it.variant_label}` : ""}</td>
                <td className="py-1.5 text-right tabular-nums">{L.locale === "bn" ? L.money(it.quantity).replace("৳", "") : it.quantity}</td>
                <td className="py-1.5 text-right tabular-nums">{money(it.unit_price_bdt)}</td>
                <td className="py-1.5 text-right tabular-nums">{money(it.line_total_bdt)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={3} className="pt-2 text-right">{t("cart.subtotal")}</td><td className="pt-2 text-right tabular-nums">{money(o.subtotal_bdt)}</td></tr>
            {o.discount_bdt > 0 && <tr><td colSpan={3} className="text-right">{t("checkout.discount")}{o.coupon_code ? ` (${o.coupon_code})` : ""}</td><td className="text-right tabular-nums">-{money(o.discount_bdt)}</td></tr>}
            <tr><td colSpan={3} className="text-right">{t("checkout.delivery")}</td><td className="text-right tabular-nums">{o.shipping_bdt === 0 ? t("pdp.free") : money(o.shipping_bdt)}</td></tr>
            <tr className="font-bold"><td colSpan={3} className="text-right">{t("checkout.total")}</td><td className="text-right tabular-nums">{money(o.total_bdt)}</td></tr>
          </tfoot>
        </table>
      </article>
    </div>
  );
}
