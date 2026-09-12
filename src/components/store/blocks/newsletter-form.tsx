"use client";

import { useState, useTransition } from "react";
import { subscribeNewsletterAction } from "@/lib/newsletter/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NewsletterForm({ heading, text, collect, buttonLabel, style, locale }: { heading: string; text: string; collect: "email" | "phone" | "both"; buttonLabel: string; style: "light" | "dark" | "amber"; locale: "en" | "bn" }) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const tone = { light: "bg-paper border", dark: "bg-ink text-paper", amber: "bg-amber text-ink" }[style];

  const submit = () =>
    start(async () => {
      setError(null);
      const r = await subscribeNewsletterAction({ email: collect !== "phone" ? email : "", phone: collect !== "email" ? phone : "", source: typeof location !== "undefined" ? location.pathname : "", locale });
      if (r.ok) setDone(r.message);
      else setError(r.error);
    });

  return (
    <div className={`rounded-2xl p-6 sm:p-8 ${tone}`}>
      <div className="mx-auto max-w-xl text-center">
        <h2 className="text-xl font-semibold sm:text-2xl">{heading}</h2>
        {text && <p className="mt-1 text-sm opacity-80">{text}</p>}
        {done ? (
          <p className="mt-4 text-sm font-medium" role="status">{done}</p>
        ) : (
          <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            {collect !== "phone" && <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email" className="bg-paper text-ink rounded-lg" />}
            {collect !== "email" && <Input type="tel" required inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" aria-label="Mobile number" className="bg-paper text-ink rounded-lg" />}
            <Button type="submit" disabled={pending} className="bg-ink text-paper hover:bg-ink-soft rounded-lg">{buttonLabel}</Button>
          </form>
        )}
        {error && <p className="text-danger mt-2 text-xs" role="alert">{error}</p>}
      </div>
    </div>
  );
}
