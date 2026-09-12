/* eslint-disable @next/next/no-img-element -- post covers from the media library */
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/store/breadcrumbs";
import { listPosts } from "@/lib/content/queries";
import { publicEnv } from "@/lib/env.public";
import { formatDateLocale } from "@/lib/i18n/format";
import { localeContext } from "@/lib/i18n/server";
import { buildMetadata } from "@/lib/seo/metadata";
import { getStoreSettings } from "@/lib/settings";

export const revalidate = 3600;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ locale }, store] = await Promise.all([params, getStoreSettings()]);
  const L = await localeContext(locale);
  return buildMetadata({ entityType: "page", entityId: null, locale: L.locale, path: "/blog", templateVars: { title: L.t("nav.blog") }, fallbackDescription: `Buying guides, comparisons and how-tos from ${store.name}.` });
}

export default async function BlogIndex({ params }: Props) {
  const [{ locale }, posts] = await Promise.all([params, listPosts()]);
  const L = await localeContext(locale);
  const crumbs = [{ label: L.t("nav.blog"), href: "/blog" }];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(publicEnv.siteUrl, crumbs)} />
      <Breadcrumbs items={crumbs} locale={L.locale} />
      <h1 className="mb-6 text-2xl font-semibold sm:text-3xl">{L.t("nav.blog")}</h1>
      {posts.length === 0 ? (
        <p className="text-muted-foreground">—</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <li key={p.id} className="bg-paper overflow-hidden rounded-2xl border">
              <Link href={`/blog/${p.slug}`} className="block">
                {p.cover_image_url ? <img src={p.cover_image_url} alt={p.cover_alt ?? ""} className="aspect-[16/9] w-full object-cover" loading="lazy" /> : <div className="bg-paper-line aspect-[16/9]" aria-hidden="true" />}
                <div className="p-4">
                  <h2 className="font-semibold leading-snug">{L.pick(p.title_en, p.title_bn)}</h2>
                  {(p.excerpt_en || p.excerpt_bn) && <p className="text-muted-foreground mt-1 line-clamp-3 text-sm">{L.pick(p.excerpt_en, p.excerpt_bn)}</p>}
                  <p className="text-muted-foreground mt-2 text-xs">
                    {formatDateLocale(p.published_at, L.locale)} · {p.reading_minutes} min
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
