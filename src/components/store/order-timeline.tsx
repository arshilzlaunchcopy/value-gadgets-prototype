import { Check, Circle } from "lucide-react";
import { formatDateLocale } from "@/lib/i18n/format";
import { t, type Locale, type MessageKey } from "@/lib/i18n/messages";

const FLOW = ["placed", "confirmed", "processing", "packed", "shipped", "delivered"] as const;
const LABELS: Record<string, string> = {
  pending_payment: "Awaiting payment",
  awaiting_advance: "Awaiting advance payment",
  placed: "Placed",
  confirmed: "Confirmed",
  processing: "Processing",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
  refunded: "Refunded",
};

export function statusLabel(s: string, locale: Locale = "en"): string {
  if (locale === "bn") {
    if (s === "placed") return "অর্ডার হয়েছে";
    const key = `status.${s}` as MessageKey;
    const v = t("bn", key);
    if (v !== key) return v;
  }
  return LABELS[s] ?? s.replace(/_/g, " ");
}

export interface TimelineEvent {
  event_type: string;
  to_status: string | null;
  note: string | null;
  created_at: string;
}

/** Status timeline for confirmation, tracking and account pages. */
export function OrderTimeline({ status, events, locale = "en" }: { status: string; events: TimelineEvent[]; locale?: Locale }) {
  const terminalBad = ["cancelled", "returned", "refunded"].includes(status);
  const reachedIdx = terminalBad ? -1 : status === "pending_payment" || status === "awaiting_advance" ? 0 : FLOW.indexOf(status as (typeof FLOW)[number]);
  const at = (s: string) => events.find((e) => e.to_status === s || (s === "placed" && e.event_type === "placed"))?.created_at;
  const when = (iso: string | undefined) => (iso ? formatDateLocale(iso, locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

  return (
    <div className="space-y-4">
      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {FLOW.map((s, i) => {
          const done = i <= reachedIdx;
          return (
            <li key={s} className="flex flex-col items-center gap-1 text-center text-xs">
              <span className={`grid size-7 place-items-center rounded-full ${done ? "bg-success text-paper" : "bg-muted text-muted-foreground"}`}>{done ? <Check className="size-4" /> : <Circle className="size-3" />}</span>
              <span className={done ? "font-medium" : "text-muted-foreground"}>{statusLabel(s, locale)}</span>
              {at(s) && <span className="text-muted-foreground">{when(at(s))}</span>}
            </li>
          );
        })}
      </ol>
      {terminalBad && <p className="text-danger text-sm font-medium">{statusLabel(status, locale)}</p>}
      {events.length > 0 && (
        <details className="text-sm">
          <summary className="text-muted-foreground cursor-pointer">{locale === "bn" ? "সম্পূর্ণ ইতিহাস" : "Full history"}</summary>
          <ul className="mt-2 space-y-1">
            {events.map((e, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-muted-foreground w-32 shrink-0 text-xs">{when(e.created_at)}</span>
                <span>{e.note ?? statusLabel(e.to_status ?? e.event_type, locale)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
