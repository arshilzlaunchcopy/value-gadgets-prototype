"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { sendOtpAction, verifyOtpAction, type SavedAddress } from "@/app/(store)/checkout/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publicEnv } from "@/lib/env.public";
import type { CurrentCustomer } from "@/lib/auth/session";

export interface PhoneStepProps {
  onVerified: (customer: CurrentCustomer, addresses: SavedAddress[], isNew: boolean) => void;
  title?: string;
}

/**
 * Step 1: phone -> code -> verified. Shared by checkout and /account login.
 * In demo mode the generated code is shown on screen (and 123456 always works).
 */
export function PhoneStep({ onVerified, title = "Your phone number" }: PhoneStepProps) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = () =>
    start(async () => {
      setError(null);
      const r = await sendOtpAction(phone);
      if (!r.ok) {
        setError(r.error ?? "Could not send the code");
        if (r.retryAfterSec) setCooldown(r.retryAfterSec);
        return;
      }
      setSent(true);
      setCooldown(r.retryAfterSec ?? 60);
      setDebugCode(r.debugCode ?? null);
      toast.success(publicEnv.demoMode && r.debugCode ? `Demo: your code is ${r.debugCode}` : "Code sent by SMS");
    });

  const verify = () =>
    start(async () => {
      setError(null);
      const r = await verifyOtpAction(phone, code);
      if (!r.ok || !("customer" in r) || !r.customer) {
        setError(("error" in r && r.error) || "Verification failed");
        return;
      }
      onVerified(r.customer, r.addresses, Boolean(r.isNew));
    });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-1">
        <Label htmlFor="phone">Mobile number</Label>
        <div className="flex gap-2">
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="01XXXXXXXXX"
            value={phone}
            disabled={sent}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !sent && send()}
            className="rounded-lg"
          />
          {!sent ? (
            <Button type="button" onClick={send} disabled={pending || phone.trim().length < 10} className="rounded-lg">
              Send code
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => { setSent(false); setCode(""); setDebugCode(null); }} className="rounded-lg">
              Change
            </Button>
          )}
        </div>
      </div>

      {sent && (
        <div className="space-y-2">
          <Label htmlFor="otp">6-digit code</Label>
          <div className="flex gap-2">
            <Input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && code.length === 6 && verify()}
              className="rounded-lg text-center text-lg tracking-[0.4em]"
              autoFocus
            />
            <Button type="button" onClick={verify} disabled={pending || code.length !== 6} className="rounded-lg">
              Verify
            </Button>
          </div>
          {debugCode && (
            <p className="bg-amber/20 text-ink rounded-lg px-3 py-2 text-sm">
              Demo mode: the SMS code is <span className="font-mono font-bold">{debugCode}</span> (or use 123456).
            </p>
          )}
          <button type="button" onClick={send} disabled={pending || cooldown > 0} className="text-muted-foreground text-xs underline disabled:no-underline disabled:opacity-60">
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
