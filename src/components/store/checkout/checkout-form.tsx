"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { placeOrderAction, quoteTotalsAction, type SavedAddress } from "@/app/[locale]/(store)/checkout/actions";
import { Button } from "@/components/ui/button";
import type { CurrentCustomer } from "@/lib/auth/session";
import type { CartSummary, Totals } from "@/lib/cart/types";
import { useMoney, useT } from "@/lib/i18n/provider";
import { useCart } from "../cart/cart-provider";
import { CouponForm } from "../cart/coupon-form";
import { AddressStep, type AddressValues } from "./address-step";
import { PhoneStep } from "./phone-step";

interface Props {
  initialCart: CartSummary;
  customer: CurrentCustomer | null;
  savedAddresses: SavedAddress[];
  reservationProblems: { title: string; requested: number; available: number }[];
  codAvailable: boolean;
}

type Step = 1 | 2 | 3;

/** Single-page, three-step checkout (BUILD_PROMPT §6.1). No account required. */
export function CheckoutForm({ initialCart, customer: initialCustomer, savedAddresses: initialSaved, reservationProblems, codAvailable }: Props) {
  const t = useT();
  const { money, number } = useMoney();
  const router = useRouter();
  const { cart, setCart, loaded } = useCart();
  const [customer, setCustomer] = useState<CurrentCustomer | null>(initialCustomer);
  const [saved, setSaved] = useState(initialSaved);
  const [step, setStep] = useState<Step>(initialCustomer ? 2 : 1);
  const [address, setAddress] = useState<AddressValues | null>(null);
  const [note, setNote] = useState("");
  const [district, setDistrict] = useState<string | null>(initialSaved[0]?.district ?? null);
  const [payment, setPayment] = useState<"cod" | "sslcommerz">(codAvailable ? "cod" : "sslcommerz");
  const [terms, setTerms] = useState(false);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!loaded) setCart(initialCart);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once
  }, []);
  const c = loaded ? cart : initialCart;

  // totals from the server whenever district / coupon / cart change
  useEffect(() => {
    let alive = true;
    void quoteTotalsAction(district, c.coupon_code).then((tt) => alive && setTotals(tt));
    return () => {
      alive = false;
    };
  }, [district, c.coupon_code, c.subtotal_bdt, c.count]);

  const submit = () =>
    start(async () => {
      setError(null);
      if (!address) return setStep(2);
      const utm = readUtm();
      const r = await placeOrderAction({ address, paymentMethod: payment, couponCode: c.coupon_code, customerNote: note, acceptTerms: terms, utm });
      if (!r.ok) {
        setError(r.error);
        if (r.code === "UNAUTHENTICATED") setStep(1);
        if (r.code === "OUT_OF_STOCK") router.refresh();
        return;
      }
      toast.success(t("checkout.placed", { n: r.orderNumber }));
      if (/^https?:\/\//.test(r.redirectUrl)) window.location.assign(r.redirectUrl);
      else router.push(r.redirectUrl);
    });

  const StepHeader = ({ n, label, done }: { n: Step; label: string; done: boolean }) => (
    <div className="flex items-center gap-2 text-sm">
      <span className={`grid size-6 place-items-center rounded-full text-xs font-bold ${done ? "bg-success text-paper" : step === n ? "bg-amber text-ink" : "bg-muted text-muted-foreground"}`}>{done ? <Check className="size-3.5" /> : number(n)}</span>
      <span className={step === n ? "font-semibold" : done ? "" : "text-muted-foreground"}>{label}</span>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        {reservationProblems.length > 0 && (
          <div className="bg-warn/10 text-ink rounded-2xl border p-4 text-sm" role="alert">
            <p className="font-semibold">{t("checkout.reservation_problem")}</p>
            <ul className="mt-1 list-disc pl-5">
              {reservationProblems.map((p) => (
                <li key={p.title}>
                  {p.title}: {number(p.requested)} → {number(p.available)}. <Link href="/cart" className="underline">{t("cart.title")}</Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Step 1 */}
        <section className="bg-paper rounded-2xl border p-4 sm:p-6">
          <StepHeader n={1} label={customer ? `${t("checkout.step_phone")}: ${customer.phone}` : t("checkout.phone_title")} done={Boolean(customer)} />
          {step === 1 && !customer && (
            <div className="mt-4">
              <PhoneStep
                onVerified={(cust, addrs) => {
                  setCustomer(cust);
                  setSaved(addrs);
                  if (addrs[0]?.district) setDistrict(addrs[0].district);
                  setStep(2);
                }}
              />
            </div>
          )}
        </section>

        {/* Step 2 */}
        <section className={`bg-paper rounded-2xl border p-4 sm:p-6 ${!customer ? "opacity-60" : ""}`}>
          <div className="flex items-center justify-between">
            <StepHeader n={2} label={address ? `${address.recipient_name}, ${address.upazila}, ${address.district}` : t("order.address")} done={Boolean(address) && step > 2} />
            {address && step === 3 && (
              <button type="button" className="text-xs underline" onClick={() => setStep(2)}>
                {t("checkout.change")}
              </button>
            )}
          </div>
          {step === 2 && customer && (
            <div className="mt-4">
              <AddressStep
                defaults={address ?? { recipient_name: customer.full_name ?? saved[0]?.recipient_name ?? "", phone: saved[0]?.phone ?? customer.phone.replace("+88", ""), division: saved[0]?.division ?? "", district: saved[0]?.district ?? "", upazila: saved[0]?.upazila ?? "", area: saved[0]?.area ?? "", street_address: saved[0]?.street_address ?? "", postcode: saved[0]?.postcode ?? "", landmark: saved[0]?.landmark ?? "" }}
                saved={saved}
                onDistrictChange={setDistrict}
                onSubmit={(v, n) => {
                  setAddress(v);
                  setNote(n);
                  setDistrict(v.district);
                  setStep(3);
                }}
              />
            </div>
          )}
        </section>

        {/* Step 3 */}
        <section className={`bg-paper rounded-2xl border p-4 sm:p-6 ${step < 3 ? "opacity-60" : ""}`}>
          <StepHeader n={3} label={t("checkout.step_payment")} done={false} />
          {step === 3 && (
            <div className="mt-4 space-y-4">
              <fieldset className="grid gap-2 sm:grid-cols-2">
                <legend className="sr-only">{t("checkout.payment_method")}</legend>
                {codAvailable && (
                  <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 ${payment === "cod" ? "border-ink ring-ink ring-1" : ""}`}>
                    <input type="radio" name="payment" value="cod" checked={payment === "cod"} onChange={() => setPayment("cod")} className="accent-amber mt-1" />
                    <span>
                      <span className="block font-medium">{t("checkout.cod")}</span>
                      <span className="text-muted-foreground text-xs">{t("checkout.cod_sub")}</span>
                    </span>
                  </label>
                )}
                <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 ${payment === "sslcommerz" ? "border-ink ring-ink ring-1" : ""}`}>
                  <input type="radio" name="payment" value="sslcommerz" checked={payment === "sslcommerz"} onChange={() => setPayment("sslcommerz")} className="accent-amber mt-1" />
                  <span>
                    <span className="block font-medium">{t("checkout.online")}</span>
                    <span className="text-muted-foreground text-xs">{t("checkout.online_sub")}</span>
                  </span>
                </label>
              </fieldset>

              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="accent-amber mt-1" />
                <span>
                  {t("checkout.terms")} <Link href="/pages/terms" className="underline" target="_blank">{t("checkout.terms_link")}</Link>, <Link href="/pages/privacy" className="underline" target="_blank">{t("checkout.privacy_link")}</Link> {t("checkout.and")}{" "}
                  <Link href="/pages/refund" className="underline" target="_blank">{t("checkout.refund_link")}</Link>
                </span>
              </label>

              {error && (
                <p role="alert" className="text-danger text-sm">
                  {error}
                </p>
              )}

              <Button size="lg" onClick={submit} disabled={pending || !terms || !totals || totals.lines.length === 0} className="w-full rounded-2xl sm:w-auto">
                {pending ? "…" : payment === "cod" ? `${t("checkout.place_order")} · ${totals ? money(totals.total_bdt) : ""}` : `${t("checkout.pay_now")} · ${totals ? money(totals.total_bdt) : ""}`}
              </Button>
            </div>
          )}
        </section>
      </div>

      {/* Summary */}
      <aside className="bg-paper h-fit space-y-4 rounded-2xl border p-4 lg:sticky lg:top-24">
        <h2 className="font-semibold">{t("checkout.summary")}</h2>
        <ul className="divide-y text-sm">
          {c.items.map((l) => (
            <li key={l.id} className="flex items-center gap-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- pre-generated thumbnail */}
              {l.image ? <img src={l.image.src} alt="" width={40} height={40} className="size-10 rounded-lg object-cover" /> : <span className="bg-paper-line size-10 rounded-lg" />}
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1">{l.title}</span>
                <span className="text-muted-foreground text-xs">× {number(l.quantity)}</span>
              </span>
              <span className="price text-xs">{money(l.line_total_bdt)}</span>
            </li>
          ))}
        </ul>
        <CouponForm />
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt>{t("cart.subtotal")}</dt><dd className="tabular-nums">{money(totals?.subtotal_bdt ?? c.subtotal_bdt)}</dd></div>
          {totals && totals.discount_bdt > 0 && <div className="text-success-deep flex justify-between"><dt>{t("checkout.discount")}</dt><dd className="tabular-nums">-{money(totals.discount_bdt)}</dd></div>}
          <div className="flex justify-between">
            <dt>{t("checkout.delivery")}{totals?.shipping ? ` (${totals.shipping.zone})` : ""}</dt>
            <dd className="tabular-nums">{totals?.shipping_bdt === null || !totals ? <span className="text-muted-foreground">{t("checkout.select_district")}</span> : totals.shipping_bdt === 0 ? t("pdp.free") : money(totals.shipping_bdt)}</dd>
          </div>
          {totals?.shipping?.estimated_days && <p className="text-muted-foreground text-xs">{t("pdp.delivery")}: {totals.shipping.estimated_days}</p>}
          <div className="flex justify-between border-t pt-2 text-base font-semibold"><dt>{t("checkout.total")}</dt><dd className="price">{money(totals?.total_bdt ?? c.subtotal_bdt)}</dd></div>
        </dl>
        <p className="text-muted-foreground text-xs">{t("cart.reserved")}</p>
      </aside>
    </div>
  );
}

function readUtm() {
  try {
    const p = new URLSearchParams(window.location.search);
    const stored = sessionStorage.getItem("vgbd_utm");
    const first = stored ? (JSON.parse(stored) as Record<string, string | null>) : null;
    const utm = {
      source: p.get("utm_source") ?? first?.source ?? null,
      medium: p.get("utm_medium") ?? first?.medium ?? null,
      campaign: p.get("utm_campaign") ?? first?.campaign ?? null,
      landing_page: first?.landing_page ?? window.location.pathname,
      referrer: first?.referrer ?? (document.referrer || null),
    };
    return utm;
  } catch {
    return undefined;
  }
}
