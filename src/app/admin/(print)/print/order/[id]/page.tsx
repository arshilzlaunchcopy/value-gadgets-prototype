import { notFound } from "next/navigation";
import { code128Svg } from "@/lib/barcode/code128";
import { formatBDT, formatDate } from "@/lib/format";
import { normalizeBD } from "@/lib/phone";
import { getStoreSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shipping label", robots: { index: false } };

/**
 * Label + invoice for printing (PART2 §14.7): A4 by default, `?size=thermal`
 * for 4x6 in. Bangla-capable (the Bengali face is loaded by the root layout) and
 * carries a Code 128 barcode of the tracking code (or order number before dispatch).
 */
export default async function LabelPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, sp, store] = await Promise.all([params, searchParams, getStoreSettings()]);
  const thermal = sp.size === "thermal";
  const bn = sp.lang === "bn";
  const admin = createAdminClient();
  const { data: o } = await admin
    .from("orders")
    .select("id, order_number, placed_at, payment_method, payment_status, total_bdt, subtotal_bdt, shipping_bdt, discount_bdt, customer_phone, customer_note, shipping_address, tracking_id, courier, order_items(product_title, variant_label, quantity, unit_price_bdt, line_total_bdt)")
    .eq("id", id)
    .maybeSingle();
  if (!o) notFound();
  const addr = (o.shipping_address ?? {}) as Record<string, string>;
  const code = o.tracking_id ?? o.order_number;
  const cod = o.payment_method === "cod" && o.payment_status !== "paid" ? o.total_bdt : 0;
  const barcode = code128Svg(code, { height: thermal ? 60 : 50, module: 2 });

  return (
    <div className={`bg-paper text-ink mx-auto p-6 print:p-0 ${thermal ? "w-[4in]" : "w-[210mm]"}`}>
      <div className="mb-4 flex items-center gap-2 print:hidden">
        <PrintButton />
        <a href={`/admin/print/order/${o.id}?${thermal ? "" : "size=thermal&"}${bn ? "lang=bn" : ""}`} className="rounded-lg border px-3 py-1.5 text-sm">{thermal ? "A4 layout" : "Thermal 4×6"}</a>
        <a href={`/admin/print/order/${o.id}?${thermal ? "size=thermal&" : ""}${bn ? "" : "lang=bn"}`} className="rounded-lg border px-3 py-1.5 text-sm" lang={bn ? "en" : "bn"}>{bn ? "English" : "বাংলা"}</a>
        <a href={`/admin/orders/${o.id}`} className="text-muted-foreground ml-auto text-sm underline">Back to order</a>
      </div>

      <section className={`rounded-2xl border-2 border-black p-4 ${thermal ? "min-h-[6in]" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold">{store.name}</p>
            <p className="text-xs">{store.address}</p>
            <p className="text-xs">{store.phone}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black tracking-wide">{cod > 0 ? `COD ${formatBDT(cod)}` : "PAID"}</p>
            <p className="text-xs">{o.courier ?? "courier"} · {formatDate(o.placed_at)}</p>
          </div>
        </div>
        <div className="my-3 flex justify-center" dangerouslySetInnerHTML={{ __html: barcode }} />
        <div className="grid gap-3 border-t-2 border-black pt-3 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase">Deliver to / প্রাপক</p>
            <p className="text-xl font-bold leading-tight">{addr.recipient_name}</p>
            <p className="text-lg font-semibold">{normalizeBD(addr.phone ?? o.customer_phone) ?? addr.phone}</p>
            <p className="text-sm">{[addr.street_address, addr.area, addr.upazila].filter(Boolean).join(", ")}</p>
            <p className="text-base font-semibold">{[addr.district, addr.division].filter(Boolean).join(", ")}{addr.postcode ? ` ${addr.postcode}` : ""}</p>
            {addr.landmark && <p className="text-xs">Landmark: {addr.landmark}</p>}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase">Order / অর্ডার</p>
            <p className="font-mono text-lg font-bold">{o.order_number}</p>
            <ul className="mt-1 text-xs">
              {(o.order_items ?? []).map((it, i) => (
                <li key={i}>
                  {it.quantity} × {it.product_title}
                  {it.variant_label ? ` (${it.variant_label})` : ""}
                </li>
              ))}
            </ul>
            {o.customer_note && <p className="mt-1 text-xs italic">Note: {o.customer_note}</p>}
          </div>
        </div>
      </section>

      {!thermal && (
        <section className="mt-6 break-before-page rounded-2xl border p-4 text-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-bold" lang={bn ? "bn" : "en"}>{bn ? "চালান" : "Invoice"}</p>
              <p className="text-xs">{store.name} · {store.address}</p>
              {store.trade_license && <p className="text-xs" lang={bn ? "bn" : "en"}>{bn ? "ট্রেড লাইসেন্স" : "Trade licence"}: {store.trade_license}</p>}
            </div>
            <div className="text-right text-xs">
              <p className="font-mono text-base font-bold">{o.order_number}</p>
              <p>{formatDate(o.placed_at)}</p>
              <p lang={bn ? "bn" : "en"}>{o.payment_method === "cod" ? (bn ? "ক্যাশ অন ডেলিভারি" : "Cash on delivery") : bn ? "অনলাইনে পরিশোধিত" : "Paid online"}</p>
            </div>
          </div>
          <table className="mt-4 w-full text-xs">
            <thead className="border-b text-left">
              <tr lang={bn ? "bn" : "en"}><th className="py-1">{bn ? "আইটেম" : "Item"}</th><th className="py-1 text-right">{bn ? "পরিমাণ" : "Qty"}</th><th className="py-1 text-right">{bn ? "একক" : "Unit"}</th><th className="py-1 text-right">{bn ? "মোট" : "Total"}</th></tr>
            </thead>
            <tbody>
              {(o.order_items ?? []).map((it, i) => (
                <tr key={i} className="border-b">
                  <td className="py-1">{it.product_title}{it.variant_label ? ` · ${it.variant_label}` : ""}</td>
                  <td className="py-1 text-right">{it.quantity}</td>
                  <td className="py-1 text-right">{formatBDT(it.unit_price_bdt)}</td>
                  <td className="py-1 text-right">{formatBDT(it.line_total_bdt)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr lang={bn ? "bn" : "en"}><td colSpan={3} className="pt-2 text-right">{bn ? "সাবটোটাল" : "Subtotal"}</td><td className="pt-2 text-right">{formatBDT(o.subtotal_bdt)}</td></tr>
              {o.discount_bdt > 0 && <tr><td colSpan={3} className="text-right">Discount</td><td className="text-right">-{formatBDT(o.discount_bdt)}</td></tr>}
              <tr lang={bn ? "bn" : "en"}><td colSpan={3} className="text-right">{bn ? "ডেলিভারি" : "Delivery"}</td><td className="text-right">{formatBDT(o.shipping_bdt)}</td></tr>
              <tr className="font-bold" lang={bn ? "bn" : "en"}><td colSpan={3} className="text-right">{bn ? "মোট" : "Total"}</td><td className="text-right">{formatBDT(o.total_bdt)}</td></tr>
            </tfoot>
          </table>
        </section>
      )}
    </div>
  );
}
