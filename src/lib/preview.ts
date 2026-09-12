import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/** Signed preview links for drafts (PART2 §13.7): HMAC over page|target|expiry. */
const TTL_MS = 2 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.PREVIEW_SECRET || process.env.AUTH_PEPPER;
  if (!s) throw new Error("PREVIEW_SECRET or AUTH_PEPPER must be set");
  return s;
}

export function signPreview(pageType: string, targetId: string | null, ttlMs = TTL_MS): string {
  const exp = Date.now() + ttlMs;
  const payload = `${pageType}|${targetId ?? ""}|${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${exp}.${sig}`;
}

export function verifyPreview(token: string | null | undefined, pageType: string, targetId: string | null): boolean {
  if (!token) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!exp || !sig || exp < Date.now()) return false;
  const expected = createHmac("sha256", secret()).update(`${pageType}|${targetId ?? ""}|${exp}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
