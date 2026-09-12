"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { signOutAction } from "@/app/[locale]/(store)/account/actions";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";
import { PhoneStep } from "./checkout/phone-step";

export function AccountLogin() {
  const router = useRouter();
  const t = useT();
  return <PhoneStep title={t("account.hint")} onVerified={() => router.refresh()} />;
}

export function SignOutButton() {
  const router = useRouter();
  const t = useT();
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
      {t("account.sign_out")}
    </Button>
  );
}
