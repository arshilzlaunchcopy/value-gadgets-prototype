import "server-only";

import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { localeSettingsSchema } from "@/lib/settings-registry";
import { formatMoney } from "./format";
import { isLocale, tFor, type Locale } from "./messages";

/** settings.locale (public): default language, switcher, Bangla numerals. */
export const getLocaleSettings = unstable_cache(
  async () => {
    const { data } = await createPublicClient().from("settings").select("value").eq("key", "locale").maybeSingle();
    const parsed = localeSettingsSchema.safeParse(data?.value ?? {});
    return parsed.success ? parsed.data : localeSettingsSchema.parse({});
  },
  ["locale-settings"],
  { revalidate: 3600, tags: ["settings", "layout"] },
);

/** Validated locale param + helpers for server components. */
export async function localeContext(localeParam: string) {
  const locale: Locale = isLocale(localeParam) ? localeParam : "en";
  const settings = await getLocaleSettings();
  const banglaNumerals = locale === "bn" && settings.bangla_numerals;
  return {
    locale,
    banglaNumerals,
    showSwitcher: settings.show_language_switcher,
    t: tFor(locale),
    money: (amount: number) => formatMoney(amount, { locale, banglaNumerals }),
    /** pick the localised content field with English fallback */
    pick: (en: string | null | undefined, bn: string | null | undefined) => (locale === "bn" && bn ? bn : (en ?? "")),
  };
}

export type LocaleContext = Awaited<ReturnType<typeof localeContext>>;
