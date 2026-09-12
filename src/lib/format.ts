/** Money is integer taka. Bangladesh uses lakh/crore grouping (en-IN). */
const bdt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function formatBDT(amount: number): string {
  return `৳${bdt.format(amount)}`;
}

export function formatNumber(n: number): string {
  return bdt.format(n);
}

/** Whole-percent discount from compare-at to price, or null when not discounted. */
export function discountPercent(price: number, compareAt: number | null | undefined): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > max * 0.6 ? cut.lastIndexOf(" ") : cut.length)}…`;
}

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", ...opts }).format(new Date(iso));
}

export function formatDateTime(iso: string | null | undefined): string {
  return formatDate(iso, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
