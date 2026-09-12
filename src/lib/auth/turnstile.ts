import "server-only";

/**
 * Cloudflare Turnstile gate for the OTP endpoint (BUILD_PROMPT §8.3).
 * Enforced only when TURNSTILE_SECRET_KEY is set; the demo has no Cloudflare
 * account, so it is a no-op there. The widget renders when
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.
 */
export function turnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstile(token: string | null | undefined, ip?: string | null): Promise<boolean> {
  if (!turnstileEnabled()) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token, ...(ip ? { remoteip: ip } : {}) }),
    });
    const json = (await res.json()) as { success?: boolean };
    return Boolean(json.success);
  } catch {
    return false;
  }
}
