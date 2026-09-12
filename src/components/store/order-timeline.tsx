import { Check, Circle } from "lucide-react";
import { formatDateTime } from "@/lib/format";

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

export function statusLabel(s: string): string {
  return LABELS[s] ?? s.replace(/_/g, " ");
}

export interface TimelineEvent {
  event_type: string;
  to_status: string | null;
  note: string | null;
  created_at: string;
}

/** Status timeline for confirmation, tracking and account pages. */
export function OrderTimeline({ status, events }: { status: string; events: TimelineEvent[] }) {
  const terminalBad = ["cancelled", "returned", "refunded"].includes(status);
  const reachedIdx = terminalBad ? -1 : status === "pending_payment" || status === "awaiting_advance" ? 0 : FLOW.indexOf(status as (typeof FLOW)[number]);
  const at = (s: string) => events.find((e) => e.to_status === s || (s === "placed" && e.event_type === "placed"))?.created_at;

  return (
    <div className="space-y-4">
      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {FLOW.map((s, i) => {
          const done = i <= reachedIdx;
          return (
            <li key={s} className="flex flex-col items-center gap-1 text-center text-xs">
              <span className={`grid size-7 place-items-center rounded-full ${done ? "bg-success text-paper" : "bg-muted text-muted-foreground"}`}>{done ? <Check className="size-4" /> : <Circle className="size-3" />}</span>
              <span className={done ? "font-medium" : "text-muted-foreground"}>{statusLabel(s)}</span>
              {at(s) && <span className="text-muted-foreground">{formatDateTime(at(s))}</span>}
            </li>
          );
        })}
      </ol>
      {terminalBad && <p className="text-danger text-sm font-medium">This order was {statusLabel(status).toLowerCase()}.</p>}
      {events.length > 0 && (
        <details className="text-sm">
          <summary className="text-muted-foreground cursor-pointer">Full history</summary>
          <ul className="mt-2 space-y-1">
            {events.map((e, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-muted-foreground w-32 shrink-0 text-xs">{formatDateTime(e.created_at)}</span>
                <span>{e.note ?? statusLabel(e.to_status ?? e.event_type)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
