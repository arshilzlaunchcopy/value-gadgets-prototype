"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction } from "./actions";

export function LoginForm({ next, initialError }: { next: string; initialError: string | null }) {
  const [error, setError] = useState<string | null>(initialError);
  const [pending, start] = useTransition();
  return (
    <form
      className="bg-paper space-y-4 rounded-2xl p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          setError(null);
          const r = await signInAction(String(fd.get("email") ?? ""), String(fd.get("password") ?? ""), next);
          if (r && !r.ok) setError(r.error);
        });
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required className="rounded-lg" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required className="rounded-lg" />
      </div>
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full rounded-2xl">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
