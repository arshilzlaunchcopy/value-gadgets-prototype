import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/store/breadcrumbs";
import { staticParamsSafe } from "@/lib/build-safe";
import { getPage } from "@/lib/content/queries";
import { publicEnv } from "@/lib/env.public";
import { localBusinessJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { getStoreSettings } from "@/lib/settings";
import { createPublicClient } from "@/lib/supabase/public";

export const revalidate = 3600;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return staticParamsSafe("pages", async () => ((await createPublicClient().from("pages").select("slug").eq("is_published", true)).data ?? []).map((p) => ({ slug: p.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return {};
  return buildMetadata({ entityType: "page", entityId: page.id, path: `/pages/${page.slug}`, templateVars: { title: page.title_en }, fallbackDescription: (page.content_en ?? "").replace(/[#*_>`-]/g, " ") });
}

/** Static pages from the `pages` table (BUILD_PROMPT §4.7): about, terms, privacy, refund, contact. */
export default async function StaticPage({ params }: Props) {
  const { slug } = await params;
  const [page, store] = await Promise.all([getPage(slug), getStoreSettings()]);
  if (!page) notFound();
  const crumbs = [{ label: page.title_en, href: `/pages/${page.slug}` }];
  const body = (page.content_en ?? "").replace(/\{store\}/g, store.name).replace(/\{phone\}/g, store.phone).replace(/\{email\}/g, store.email).replace(/\{address\}/g, store.address).replace(/\{trade_license\}/g, store.trade_license);
  return (
    <article className="mx-auto max-w-2xl">
      <JsonLd data={[breadcrumbJsonLd(publicEnv.siteUrl, crumbs), ...(slug === "contact" ? [localBusinessJsonLd(store)] : [])]} />
      <Breadcrumbs items={crumbs} />
      <h1 className="text-2xl font-semibold sm:text-3xl">{page.title_en}</h1>
      {page.title_bn && (
        <p lang="bn" className="text-muted-foreground mt-1">
          {page.title_bn}
        </p>
      )}
      <div className="prose prose-neutral mt-6 max-w-none text-sm leading-relaxed [&_a]:underline [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_p]:my-2">
        <Markdown>{body}</Markdown>
      </div>
      {slug === "contact" && (
        <dl className="bg-paper mt-6 grid gap-2 rounded-2xl border p-4 text-sm sm:grid-cols-2">
          {store.phone && <div><dt className="text-muted-foreground text-xs uppercase">Phone</dt><dd><a href={`tel:${store.phone}`} className="underline">{store.phone}</a></dd></div>}
          {store.whatsapp && <div><dt className="text-muted-foreground text-xs uppercase">WhatsApp</dt><dd><a href={`https://wa.me/${store.whatsapp.replace(/\D/g, "")}`} className="underline" rel="noopener">{store.whatsapp}</a></dd></div>}
          {store.email && <div><dt className="text-muted-foreground text-xs uppercase">Email</dt><dd><a href={`mailto:${store.email}`} className="underline">{store.email}</a></dd></div>}
          {store.address && <div><dt className="text-muted-foreground text-xs uppercase">Address</dt><dd>{store.address}</dd></div>}
        </dl>
      )}
    </article>
  );
}
