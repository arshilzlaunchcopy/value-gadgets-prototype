import { BadgeCheck, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import type { ReviewPublic, ShippingEstimate } from "@/lib/catalog/queries";
import { formatDateLocale } from "@/lib/i18n/format";
import type { LocaleContext } from "@/lib/i18n/server";
import { RatingStars } from "../rating-stars";

type L = Pick<LocaleContext, "t" | "money" | "locale">;

export function TrustRow({ warrantyMonths, shipping, returnDays, L }: { warrantyMonths: number; shipping: ShippingEstimate[]; returnDays: number; L: L }) {
  const { t, money } = L;
  return (
    <ul className="grid gap-2 rounded-2xl border p-3 text-sm sm:grid-cols-3">
      <li className="flex items-start gap-2">
        <ShieldCheck className="text-amber-deep mt-0.5 size-4 shrink-0" />
        <span>
          <span className="block font-medium">{warrantyMonths > 0 ? t("pdp.warranty_months", { n: warrantyMonths }) : t("pdp.warranty_checked")}</span>
          <span className="text-muted-foreground text-xs">{t("pdp.warranty_sub")}</span>
        </span>
      </li>
      <li className="flex items-start gap-2">
        <Truck className="text-amber-deep mt-0.5 size-4 shrink-0" />
        <span>
          <span className="block font-medium">{t("pdp.delivery")}</span>
          <span className="text-muted-foreground block text-xs">
            {shipping.map((z) => `${z.zone}: ${z.estimated_days ?? "-"}, ${z.rate_bdt === 0 ? t("pdp.free") : money(z.rate_bdt)}`).join(" · ")}
          </span>
        </span>
      </li>
      <li className="flex items-start gap-2">
        <RotateCcw className="text-amber-deep mt-0.5 size-4 shrink-0" />
        <span>
          <span className="block font-medium">{t("pdp.returns", { n: returnDays })}</span>
          <span className="text-muted-foreground text-xs">{t("pdp.returns_sub")}</span>
        </span>
      </li>
    </ul>
  );
}

export function SpecTable({ specs, L }: { specs: { label: string; value: string }[]; L: L }) {
  if (specs.length === 0) return null;
  return (
    <section aria-labelledby="specs">
      <h2 id="specs" className="mb-3 text-lg font-semibold">
        {L.t("pdp.specs")}
      </h2>
      <div className="overflow-x-auto rounded-2xl border">
        <table className="w-full text-sm">
          <tbody>
            {specs.map((s, i) => (
              <tr key={i} className="even:bg-paper-soft border-b last:border-0">
                <th scope="row" className="w-1/3 px-3 py-2 text-left font-medium">
                  {s.label}
                </th>
                <td className="px-3 py-2">{s.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function Highlights({ items, L }: { items: string[]; L: L }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="highlights">
      <h2 id="highlights" className="mb-3 text-lg font-semibold">
        {L.t("pdp.highlights")}
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((h) => (
          <li key={h} className="bg-paper flex items-start gap-2 rounded-2xl border p-3 text-sm">
            <BadgeCheck className="text-amber-deep mt-0.5 size-4 shrink-0" />
            {h}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Description({ text, L }: { text: string | null; L: L }) {
  if (!text) return null;
  const blocks = text.split(/\n{2,}/);
  return (
    <section aria-labelledby="desc">
      <h2 id="desc" className="mb-3 text-lg font-semibold">
        {L.t("pdp.description")}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed">
        {blocks.map((b, i) =>
          b.trim().startsWith("- ") ? (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {b.split("\n").map((l, j) => (
                <li key={j}>{l.replace(/^- /, "")}</li>
              ))}
            </ul>
          ) : (
            <p key={i}>{b}</p>
          ),
        )}
      </div>
    </section>
  );
}

export function Reviews({ reviews, avg, count, L }: { reviews: ReviewPublic[]; avg: number | null; count: number; L: L }) {
  const { t } = L;
  return (
    <section aria-labelledby="reviews">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 id="reviews" className="text-lg font-semibold">
          {t("pdp.reviews")}
        </h2>
        <RatingStars rating={avg} count={count} emptyLabel={t("catalog.no_reviews")} />
      </div>
      {reviews.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("pdp.reviews_empty")}</p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="bg-paper rounded-2xl border p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <RatingStars rating={r.rating} count={1} showCount={false} />
                <span className="font-medium">{r.reviewer_name ?? "Customer"}</span>
                {r.is_verified_purchase && (
                  <span className="bg-success/10 text-success-deep inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs">
                    <BadgeCheck className="size-3" /> {t("pdp.verified")}
                  </span>
                )}
                <span className="text-muted-foreground ml-auto text-xs">{formatDateLocale(r.created_at, L.locale)}</span>
              </div>
              {r.title && <p className="mt-2 font-semibold">{r.title}</p>}
              {r.body && <p className="mt-1">{r.body}</p>}
              {r.admin_reply && (
                <p className="bg-paper-soft mt-3 rounded-lg p-3 text-xs">
                  <span className="font-semibold">{L.locale === "bn" ? "স্টোরের উত্তর:" : "Store reply:"}</span> {r.admin_reply}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
