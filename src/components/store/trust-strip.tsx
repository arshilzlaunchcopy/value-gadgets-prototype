import { BadgeCheck, RotateCcw, ShieldCheck, Truck, type LucideIcon } from "lucide-react";
import type { TrustBadge } from "@/lib/settings";

const ICONS: Record<string, LucideIcon> = { "shield-check": ShieldCheck, truck: Truck, "badge-check": BadgeCheck, "rotate-ccw": RotateCcw };

/** Trust strip echoing the marketing creative style (BUILD_PROMPT §6.1). */
export function TrustStrip({ badges, compact = false }: { badges: TrustBadge[]; compact?: boolean }) {
  return (
    <ul className={`grid gap-3 ${compact ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"}`}>
      {badges.map((b) => {
        const Icon = ICONS[b.icon] ?? ShieldCheck;
        return (
          <li key={b.title} className="bg-paper flex items-start gap-3 rounded-2xl border p-3 sm:p-4">
            <span className="bg-ink text-amber grid size-9 shrink-0 place-items-center rounded-lg">
              <Icon className="size-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold">{b.title}</span>
              <span className="text-muted-foreground block text-xs">{b.text}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
