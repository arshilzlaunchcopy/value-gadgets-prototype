import { discountPercent, formatBDT } from "@/lib/format";

export function DiscountBadge({ price, compareAt, className = "" }: { price: number; compareAt: number | null | undefined; className?: string }) {
  const pct = discountPercent(price, compareAt);
  if (!pct) return null;
  return <span className={`bg-amber text-ink rounded-lg px-2 py-0.5 text-xs font-bold ${className}`}>-{pct}%</span>;
}

export function Price({ price, compareAt, size = "md", className = "" }: { price: number; compareAt?: number | null; size?: "sm" | "md" | "lg"; className?: string }) {
  const sizes = { sm: "text-sm", md: "text-base", lg: "text-2xl" } as const;
  const showCompare = compareAt && compareAt > price;
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 ${className}`}>
      <span className={`price ${sizes[size]}`}>{formatBDT(price)}</span>
      {showCompare && <s className="text-muted-foreground text-xs tabular-nums">{formatBDT(compareAt)}</s>}
    </span>
  );
}
