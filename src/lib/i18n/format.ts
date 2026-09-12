import type { Locale } from "./messages";

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
const grouped = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** 1250 -> "১,২৫০" (lakh/crore grouping kept, digits swapped). */
export function toBanglaDigits(s: string): string {
  return s.replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

export interface MoneyOptions {
  locale?: Locale;
  /** theme/settings flag: show Bangla numerals when the site is in Bangla (PART2 §15.3) */
  banglaNumerals?: boolean;
}

/** Money is integer taka; formatting is presentation only. */
export function formatMoney(amount: number, opts: MoneyOptions = {}): string {
  const s = `৳${grouped.format(amount)}`;
  return opts.locale === "bn" && opts.banglaNumerals ? toBanglaDigits(s) : s;
}

export function formatNumberLocale(n: number, opts: MoneyOptions = {}): string {
  const s = grouped.format(n);
  return opts.locale === "bn" && opts.banglaNumerals ? toBanglaDigits(s) : s;
}

export function formatDateLocale(iso: string | null | undefined, locale: Locale, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", ...opts }).format(new Date(iso));
}
