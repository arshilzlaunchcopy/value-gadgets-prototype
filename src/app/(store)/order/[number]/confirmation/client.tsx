"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { retryPaymentAction } from "@/app/(store)/checkout/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProfileAction } from "./actions";

export function PayNowButton({ orderNumber }: { orderNumber: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      className="mt-4 rounded-2xl"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await retryPaymentAction(orderNumber);
          if (r.ok && r.redirectUrl) window.location.assign(r.redirectUrl);
          else toast.error(r.error ?? "Could not start payment");
        })
      }
    >
      {pending ? "Opening gateway…" : "Pay now"}
    </Button>
  );
}

/** Progressive profiling (BUILD_PROMPT §8.6): name, then email, never blocking. */
export function ProfileForm({ hasName, hasEmail }: { hasName: boolean; hasEmail: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const field = !hasName ? "full_name" : "email";
  if (hasName && hasEmail) return null;
  return (
    <form
      className="flex max-w-md gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updateProfileAction(field, value);
          if (r.ok) {
            toast.success("Saved");
            setValue("");
            router.refresh();
          } else toast.error(r.error ?? "Could not save");
        });
      }}
    >
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={field === "full_name" ? "Your name" : "Email address"} type={field === "email" ? "email" : "text"} autoComplete={field === "email" ? "email" : "name"} className="rounded-lg" />
      <Button type="submit" variant="outline" disabled={pending || !value.trim()} className="rounded-lg">
        Save
      </Button>
    </form>
  );
}
