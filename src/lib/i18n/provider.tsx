"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { formatMoney, formatNumberLocale } from "./format";
import { t, type Locale, type MessageKey } from "./messages";

interface LocaleCtx {
  locale: Locale;
  banglaNumerals: boolean;
}

const Ctx = createContext<LocaleCtx>({ locale: "en", banglaNumerals: false });

/** Provides locale + numeral preference to client islands; sets <html lang> without making the root layout dynamic. */
export function LocaleProvider({ locale, banglaNumerals, children }: LocaleCtx & { children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, banglaNumerals }), [locale, banglaNumerals]);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocale(): LocaleCtx {
  return useContext(Ctx);
}

export function useT() {
  const { locale } = useContext(Ctx);
  return (key: MessageKey, vars?: Record<string, string | number>) => t(locale, key, vars);
}

/** Money formatter bound to the current locale + numerals setting. */
export function useMoney() {
  const { locale, banglaNumerals } = useContext(Ctx);
  return {
    money: (amount: number) => formatMoney(amount, { locale, banglaNumerals }),
    number: (n: number) => formatNumberLocale(n, { locale, banglaNumerals }),
    locale,
  };
}
