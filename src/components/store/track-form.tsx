"use client";

import { useState, useTransition } from "react";
import { trackOrderAction, type TrackedOrder } from "@/app/[locale]/(store)/track/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateLocale } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/messages";
import { useMoney, useT } from "@/lib/i18n/provider";
import { OrderTimeline } from "./order-timeline";

export function TrackForm({ initialOrder = "" }: { initialOrder?: string }) {
  const t = useT();
  const { money, locale } = useMoney();
  const [phone, setPhone] = useState("");
  const [number, setNumber] = useState(initialOrder);
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-6">
      <form
        className="bg-paper grid gap-4 rounded-2xl border p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setError(null);
            const r = await trackOrderAction(phone, number);
            if (r.ok) setOrder(r.order);
            else {
              setOrder(null);
              setError(r.error);
            }
          });
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="t-phone">{t("checkout.mobile")}</Label>
          <Input id="t-phone" type="tel" inputMode="tel" placeholder="01XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-lg" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="t-number">{t("track.order_number")}</Label>
          <Input id="t-number" placeholder="VGBD-260912-AB12" value={number} onChange={(e) => setNumber(e.target.value.toUpperCase())} className="rounded-lg uppercase" required />
        </div>
        <Button type="submit" disabled={pending} className="rounded-2xl">
          {t("track.submit")}
        </Button>
        {error && (
          <p role="alert" className="text-danger text-sm sm:col-span-3">
            {error}
          </p>
        )}
      </form>

      {order && (
        <section className="bg-paper space-y-4 rounded-2xl border p-4 sm:p-6" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">{t("order.title", { n: order.order_number })}</h2>
            <span className="text-muted-foreground text-xs">{formatDateLocale(order.placed_at, locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="bg-muted rounded-lg px-2 py-1">{t("order.status")}: {t(`status.${order.status}` as MessageKey)}</span>
            <span className="bg-muted rounded-lg px-2 py-1">{t("order.payment")}: {t(`payment.${order.payment_status}` as MessageKey)} ({order.payment_method === "cod" ? t("checkout.cod") : t("checkout.online")})</span>
            <span className="bg-muted rounded-lg px-2 py-1">{t("checkout.total")}: {money(order.total_bdt)}</span>
            {order.tracking_id && <span className="bg-amber/20 rounded-lg px-2 py-1"><span className="font-mono">{order.tracking_id}</span></span>}
            {order.shipment_status && <span className="bg-muted rounded-lg px-2 py-1">{order.shipment_status.replace(/_/g, " ")}</span>}
          </div>
          <OrderTimeline status={order.status} events={order.events} locale={locale} />
          <ul className="text-muted-foreground text-sm">
            {order.items.map((it, i) => (
              <li key={i}>
                {it.quantity} × {it.product_title}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
