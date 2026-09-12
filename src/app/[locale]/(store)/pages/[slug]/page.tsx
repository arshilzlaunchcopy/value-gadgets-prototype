import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/store/breadcrumbs";
import { staticParamsSafe } from "@/lib/build-safe";
import { getPage } from "@/lib/content/queries";
import { publicEnv } from "@/lib/env.public";
import { localeContext } from "@/lib/i18n/server";
import { localBusinessJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { getStoreSettings } from "@/lib/settings";
import { createPublicClient } from "@/lib/supabase/public";

export const revalidate = 3600;
export const dynamicParams = true;

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateStaticParams() {
  return staticParamsSafe("pages", async () => ((await createPublicClient().from("pages").select("slug").eq("is_published", true)).data ?? []).map((p) => ({ slug: p.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = await getPage(slug);
  if (!page) return {};
  const L = await localeContext(locale);
  return buildMetadata({ entityType: "page", entityId: page.id, locale: L.locale, path: `/pages/${page.slug}`, templateVars: { title: L.pick(page.title_en, page.title_bn) }, fallbackDescription: (L.pick(page.content_en, page.content_bn) ?? "").replace(/[#*_>`-]/g, " ") });
}

/** Static pages from the `pages` table (BUILD_PROMPT §4.7) in the page language; Bangla T&C for DBID (PART2 §15.3). */
export default async function StaticPage({ params }: Props) {
  const { locale, slug } = await params;
  const [page, store, L] = await Promise.all([getPage(slug), getStoreSettings(), localeContext(locale)]);
  if (!page) notFound();
  const title = L.pick(page.title_en, page.title_bn);
  const crumbs = [{ label: title, href: `/pages/${page.slug}` }];
  const raw = L.locale === "bn" && page.content_bn ? page.content_bn : (page.content_en ?? "");
  const body = raw.replace(/\{store\}/g, store.name).replace(/\{phone\}/g, store.phone).replace(/\{email\}/g, store.email).replace(/\{address\}/g, store.address).replace(/\{trade_license\}/g, store.trade_license);
  const usingFallback = L.locale === "bn" && !page.content_bn;
  return (
    <article className="mx-auto max-w-2xl" lang={usingFallback ? "en" : L.locale}>
      <JsonLd data={[breadcrumbJsonLd(publicEnv.siteUrl, crumbs), ...(slug === "contact" ? [localBusinessJsonLd(store)] : [])]} />
      <Breadcrumbs items={crumbs} locale={L.locale} />
      <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
      {L.locale === "en" && page.title_bn && (
        <p lang="bn" className="text-muted-foreground mt-1">
          {page.title_bn}
        </p>
      )}
      <div className="prose prose-neutral mt-6 max-w-none text-sm leading-relaxed [&_a]:underline [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_p]:my-2">
        <Markdown>{body}</Markdown>
      </div>
      {slug === "contact" && (
        <dl className="bg-paper mt-6 grid gap-2 rounded-2xl border p-4 text-sm sm:grid-cols-2">
          {store.phone && <div><dt className="text-muted-foreground text-xs uppercase">{L.t("footer.contact")}</dt><dd><a href={`tel:${store.phone}`} className="underline">{store.phone}</a></dd></div>}
          {store.whatsapp && <div><dt className="text-muted-foreground text-xs uppercase">{L.t("footer.whatsapp")}</dt><dd><a href={`https://wa.me/${store.whatsapp.replace(/\D/g, "")}`} className="underline" rel="noopener">{store.whatsapp}</a></dd></div>}
          {store.email && <div><dt className="text-muted-foreground text-xs uppercase">Email</dt><dd><a href={`mailto:${store.email}`} className="underline">{store.email}</a></dd></div>}
          {store.address && <div><dt className="text-muted-foreground text-xs uppercase">{L.locale === "bn" ? "ঠিকানা" : "Address"}</dt><dd>{store.address}</dd></div>}
        </dl>
      )}
    </article>
  );
}
