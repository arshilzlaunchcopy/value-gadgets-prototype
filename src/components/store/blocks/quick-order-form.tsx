"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { sendOtpAction, verifyOtpAction } from "@/app/(store)/checkout/actions";
import { quickOrderAction } from "@/app/lp/[slug]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { publicEnv } from "@/lib/env.public";
import { formatBDT } from "@/lib/format";
import type { PictureData } from "@/lib/media/picture";
import { Picture } from "../picture";
import { Price } from "../price";

export interface QuickOrderProduct {
  id: string;
  slug: string;
  title_en: string;
  title_bn: string | null;
  image: PictureData | null;
  variants: { id: string; label: string | null; price_bdt: number; compare_at_price_bdt: number | null; available_qty: number; is_default: boolean }[];
  shipping: { zone: string; districts: string[]; rate_bdt: number; free_above_bdt: number | null; estimated_days: string | null }[];
}

interface Props {
  product: QuickOrderProduct;
  landingSlug: string | null;
  heading: string;
  buttonLabel: string;
  showQuantity: boolean;
  maxQuantity: number;
  collectNote: boolean;
  successMessage: string;
  locale: "en" | "bn";
}

interface District {
  id: string;
  name_en: string;
  name_bn: string | null;
}

function readUtm() {
  if (typeof window === "undefined") return undefined;
  const p = new URLSearchParams(window.location.search);
  return { source: p.get("utm_source"), medium: p.get("utm_medium"), campaign: p.get("utm_campaign"), landing_page: window.location.pathname, referrer: document.referrer.slice(0, 300) || null };
}

function readVariant(slug: string | null): "a" | "b" {
  if (typeof document === "undefined" || !slug) return "a";
  const m = document.cookie.match(new RegExp(`(?:^|; )vg_ab_${slug.replace(/[^a-z0-9-]/gi, "")}=(a|b)`));
  const q = new URLSearchParams(window.location.search).get("variant");
  return q === "b" ? "b" : q === "a" ? "a" : ((m?.[1] as "a" | "b" | undefined) ?? "a");
}

/** Three fields, one screen. Delivery charge shown as soon as the district is picked. */
export function QuickOrderForm({ product, landingSlug, heading, buttonLabel, showQuantity, maxQuantity, collectNote, successMessage, locale }: Props) {
  const defaultVariant = product.variants.find((v) => v.is_default && v.available_qty > 0) ?? product.variants.find((v) => v.available_qty > 0) ?? product.variants[0];
  const [variantId, setVariantId] = useState(defaultVariant?.id ?? "");
  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [districts, setDistricts] = useState<District[]>([]);
  const [otp, setOtp] = useState<{ sent: boolean; code: string; debug: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ orderNumber: string; redirectUrl: string } | null>(null);
  const [pending, start] = useTransition();
  const bn = locale === "bn";

  useEffect(() => {
    fetch("/api/locations?level=district")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j: { items: District[] }) => setDistricts([...j.items].sort((a, b) => a.name_en.localeCompare(b.name_en))))
      .catch(() => setDistricts([]));
  }, []);

  const variant = product.variants.find((v) => v.id === variantId) ?? defaultVariant;
  const zone = useMemo(() => {
    if (!district) return null;
    const d = district.toLowerCase();
    return product.shipping.find((z) => z.districts.some((x) => x.toLowerCase() === d)) ?? product.shipping.find((z) => z.districts.length === 0) ?? null;
  }, [district, product.shipping]);
  const subtotal = (variant?.price_bdt ?? 0) * qty;
  const delivery = zone ? (zone.free_above_bdt !== null && subtotal >= zone.free_above_bdt ? 0 : zone.rate_bdt) : null;
  const total = subtotal + (delivery ?? 0);

  const place = () =>
    start(async () => {
      setError(null);
      if (!variant) return;
      const r = await quickOrderAction({ landing_slug: landingSlug ?? "", variant_id: variant.id, quantity: qty, name, phone, district, address, note, ab_variant: readVariant(landingSlug), utm: readUtm() });
      if (r.ok) {
        setDone({ orderNumber: r.orderNumber, redirectUrl: r.redirectUrl });
        toast.success(`${bn ? "অর্ডার" : "Order"} ${r.orderNumber}`);
        setTimeout(() => window.location.assign(r.redirectUrl), 1500);
        return;
      }
      if ("needsOtp" in r && r.needsOtp) {
        const s = await sendOtpAction(phone);
        if (!s.ok) return setError(s.error ?? "Could not send the code");
        setOtp({ sent: true, code: "", debug: s.debugCode ?? null });
        return;
      }
      setError("error" in r ? r.error : "Could not place the order");
    });

  const verify = () =>
    start(async () => {
      if (!otp) return;
      const v = await verifyOtpAction(phone, otp.code);
      if (!v.ok) return setError(("error" in v && v.error) || "Verification failed");
      setOtp(null);
      place();
    });

  if (done) {
    return (
      <div className="bg-success/10 rounded-2xl border p-6 text-center" role="status">
        <p className="text-lg font-semibold">{bn ? "অর্ডার নেওয়া হয়েছে" : "Order received"} · {done.orderNumber}</p>
        <p className="text-muted-foreground mt-1 text-sm">{successMessage}</p>
      </div>
    );
  }

  return (
    <form
      id="quick-order"
      className="bg-paper grid gap-5 rounded-2xl border p-4 sm:grid-cols-[200px_1fr] sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (otp?.sent) verify();
        else place();
      }}
    >
      <div className="space-y-2">
        <Picture data={product.image} sizes="200px" className="block aspect-square overflow-hidden rounded-xl" imgClassName="h-full w-full object-cover" />
        <p className="text-sm font-semibold" lang={bn && product.title_bn ? "bn" : undefined}>{(bn && product.title_bn) || product.title_en}</p>
        {variant && <Price price={variant.price_bdt} compareAt={variant.compare_at_price_bdt} />}
        {product.variants.some((v) => v.label) && (
          <div className="flex flex-wrap gap-1.5" role="radiogroup">
            {product.variants.map((v) => (
              <button key={v.id} type="button" role="radio" aria-checked={v.id === variantId} disabled={v.available_qty <= 0} onClick={() => setVariantId(v.id)} className={`rounded-lg border px-2 py-1 text-xs disabled:opacity-40 ${v.id === variantId ? "bg-ink text-paper border-ink" : ""}`}>
                {v.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-3">
        <h2 className="text-xl font-semibold" lang={bn ? "bn" : undefined}>{heading}</h2>
        {otp?.sent ? (
          <div className="space-y-2">
            <Label htmlFor="qo-otp">{bn ? "৬ সংখ্যার কোড" : "6-digit code sent to"} {phone}</Label>
            <Input id="qo-otp" inputMode="numeric" maxLength={6} value={otp.code} onChange={(e) => setOtp({ ...otp, code: e.target.value.replace(/\D/g, "").slice(0, 6) })} className="rounded-lg text-center text-lg tracking-[0.4em]" autoFocus />
            {otp.debug && publicEnv.demoMode && <p className="bg-amber/20 rounded-lg px-3 py-2 text-xs">Demo mode: the code is <span className="font-mono font-bold">{otp.debug}</span> (or 123456).</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={pending || otp.code.length !== 6} className="bg-amber text-ink hover:bg-amber-lite rounded-2xl font-semibold">{bn ? "যাচাই করুন" : "Verify & order"}</Button>
              <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setOtp(null)}>{bn ? "ফিরে যান" : "Back"}</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="qo-name">{bn ? "আপনার নাম" : "Your name"}</Label>
                <Input id="qo-name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="rounded-lg" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="qo-phone">{bn ? "মোবাইল নম্বর" : "Mobile number"}</Label>
                <Input id="qo-phone" required type="tel" inputMode="tel" placeholder="01XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel-national" className="rounded-lg" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
              <div className="space-y-1">
                <Label htmlFor="qo-district">{bn ? "জেলা" : "District"}</Label>
                <select id="qo-district" required value={district} onChange={(e) => setDistrict(e.target.value)} className="bg-paper h-10 w-full rounded-lg border px-3 text-sm">
                  <option value="">{bn ? "জেলা বাছুন" : "Select district"}</option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.name_en}>{bn && d.name_bn ? d.name_bn : d.name_en}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="qo-address">{bn ? "সম্পূর্ণ ঠিকানা" : "Full address"}</Label>
                <Textarea id="qo-address" required minLength={5} rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder={bn ? "বাসা, রোড, এলাকা, থানা" : "House, road, area, thana"} className="rounded-lg" />
              </div>
            </div>
            {collectNote && <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={bn ? "নোট (ঐচ্ছিক)" : "Note (optional)"} className="rounded-lg" aria-label="Note" />}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              {showQuantity ? (
                <div className="flex items-center gap-2">
                  <Label htmlFor="qo-qty">{bn ? "পরিমাণ" : "Qty"}</Label>
                  <select id="qo-qty" value={qty} onChange={(e) => setQty(Number(e.target.value))} className="bg-paper h-9 rounded-lg border px-2 text-sm">
                    {Array.from({ length: Math.min(maxQuantity, Math.max(1, variant?.available_qty ?? 1)) }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              ) : <span />}
              <p className="text-sm">
                {bn ? "ডেলিভারি" : "Delivery"}: {delivery === null ? (bn ? "জেলা বাছুন" : "select district") : delivery === 0 ? (bn ? "ফ্রি" : "Free") : formatBDT(delivery)}
                {zone?.estimated_days ? ` · ${zone.estimated_days}` : ""}
                <span className="price ml-3 text-base">{bn ? "মোট" : "Total"} {formatBDT(total)}</span>
              </p>
            </div>
            <Button type="submit" disabled={pending || !variant || variant.available_qty <= 0} className="bg-amber text-ink hover:bg-amber-lite h-12 w-full rounded-2xl text-base font-semibold">
              {pending ? "…" : variant && variant.available_qty <= 0 ? (bn ? "স্টক নেই" : "Out of stock") : buttonLabel}
            </Button>
            <p className="text-muted-foreground text-center text-xs">{bn ? "ক্যাশ অন ডেলিভারি · অফিসিয়াল ওয়ারেন্টি" : "Cash on delivery · official warranty"}</p>
          </>
        )}
        {error && <p role="alert" className="text-danger text-sm">{error}</p>}
      </div>
    </form>
  );
}
