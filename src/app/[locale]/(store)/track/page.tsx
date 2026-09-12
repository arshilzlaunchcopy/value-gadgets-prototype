import type { Metadata } from "next";
import { TrackForm } from "@/components/store/track-form";
import { localeContext } from "@/lib/i18n/server";
import { languageAlternates } from "@/lib/seo/metadata";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const L = await localeContext((await params).locale);
  return { title: L.t("track.title"), alternates: { canonical: L.locale === "bn" ? "/bn/track" : "/track", languages: languageAlternates("/track") } };
}

export default async function TrackPage({ params, searchParams }: Props) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  const L = await localeContext(locale);
  const order = typeof sp.order === "string" ? sp.order : "";
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-2xl font-semibold sm:text-3xl">{L.t("track.title")}</h1>
      <p className="text-muted-foreground mb-6 text-sm">{L.t("track.hint")}</p>
      <TrackForm initialOrder={order} />
    </div>
  );
}
