"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { signOutAction } from "@/app/(store)/account/actions";
import { Button } from "@/components/ui/button";
import { PhoneStep } from "./checkout/phone-step";

export function AccountLogin() {
  const router = useRouter();
  return <PhoneStep title="Sign in with your mobile number" onVerified={() => router.refresh()} />;
}

export function SignOutButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      className="rounded-2xl"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await signOutAction();
          router.refresh();
        })
      }
    >
      Sign out
    </Button>
  );
}
