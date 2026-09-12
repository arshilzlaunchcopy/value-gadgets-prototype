"use client";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/messages";

export function InvoiceToolbar({ locale, number }: { locale: Locale; number: string }) {
  const t = useT();
  const other = locale === "bn" ? `/en/order/${number}/invoice` : `/bn/order/${number}/invoice`;
  return (
    <div className="mb-4 flex items-center gap-2 print:hidden">
      <Button type="button" className="rounded-lg" onClick={() => window.print()}>{t("misc.print")}</Button>
      <a href={other} className="rounded-lg border px-3 py-1.5 text-sm" lang={locale === "bn" ? "en" : "bn"}>{locale === "bn" ? "English" : "বাংলা"}</a>
    </div>
  );
}
