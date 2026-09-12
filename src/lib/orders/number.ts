import { randomInt } from "node:crypto";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** VGBD-YYMMDD-XXXX (BUILD_PROMPT §4.3), date in Asia/Dhaka. */
export function generateOrderNumber(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", year: "2-digit", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  let s = "";
  for (let i = 0; i < 4; i++) s += CODE_CHARS[randomInt(CODE_CHARS.length)];
  return `VGBD-${get("year")}${get("month")}${get("day")}-${s}`;
}

export function isOrderNumber(s: string): boolean {
  return /^VGBD-\d{6}-[A-Z0-9]{4}$/.test(s.trim().toUpperCase());
}
