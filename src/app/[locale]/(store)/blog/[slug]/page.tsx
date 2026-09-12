/* eslint-disable @next/next/no-img-element -- post cover from the media library */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/store/breadcrumbs";
import { ProductGrid, SectionHeading } from "@/components/store/product-grid";
import { staticParamsSafe } from "@/lib/build-safe";
import { getProductsForSource } from "@/lib/catalog/queries";
import { getPost, listPosts } from "@/lib/content/queries";
import { publicEnv } from "@/lib/env.public";
import { formatDateLocale } from "@/lib/i18n/format";
import { localeContext } from "@/lib/i18n/server";
import { articleJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { getStoreSettings } from "@/lib/settings";
import { createPublicClient } from "@/lib/supabase/public";

export const revalidate = 3600;
export const dynamicParams = true;

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateStaticParams() {
  return staticParamsSafe("posts", async () => (await listPosts(100)).map((p) => ({ slug: p.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};
  const L = await localeContext(locale);
  return buildMetadata({ entityType: "post", entityId: post.id, locale: L.locale, path: `/blog/${post.slug}`, templateVars: { title: L.pick(post.title_en, post.title_bn) }, fallbackDescription: L.pick(post.excerpt_en, post.excerpt_bn) || post.content_en, image: post.cover_image_url ? { url: post.cover_image_url, alt: post.cover_alt ?? post.title_en } : null, ogType: "article", publishedTime: post.published_at, modifiedTime: post.updated_at });
}

/** Blog post with Article JSON-LD (BUILD_PROMPT §7.3) and related products; Bangla body when present. */
export default async function PostPage({ params }: Props) {
  const { locale, slug } = await params;
  const [post, store, L] = await Promise.all([getPost(slug), getStoreSettings(), localeContext(locale)]);
  if (!post) notFound();
  let related: Awaited<ReturnType<typeof getProductsForSource>> = [];
  if (post.related_product_ids.length) {
    const { data } = await createPublicClient().from("products_public").select("slug").in("id", post.related_product_ids);
    const slugs = (data ?? []).map((p) => p.slug!).filter(Boolean);
    if (slugs.length) related = await getProductsForSource({ source: "manual", slugs, limit: 8 });
  }
  const title = L.pick(post.title_en, post.title_bn);
  const body = L.locale === "bn" && post.content_bn ? post.content_bn : (post.content_en ?? "");
  const crumbs = [{ label: L.t("nav.blog"), href: "/blog" }, { label: title, href: `/blog/${post.slug}` }];
  return (
    <article className="mx-auto max-w-2xl" lang={L.locale === "bn" && !post.content_bn ? "en" : L.locale}>
      <JsonLd data={[articleJsonLd(post, store), breadcrumbJsonLd(publicEnv.siteUrl, crumbs)]} />
      <Breadcrumbs items={crumbs} locale={L.locale} />
      <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">{title}</h1>
      <p className="text-muted-foreground mt-2 text-xs">
        {post.author_name ? `${post.author_name} · ` : ""}{formatDateLocale(post.published_at, L.locale)} · {post.reading_minutes} min
      </p>
      {post.cover_image_url && <img src={post.cover_image_url} alt={post.cover_alt ?? ""} className="mt-4 aspect-[16/9] w-full rounded-2xl object-cover" />}
      {L.pick(post.excerpt_en, post.excerpt_bn) && <p className="text-muted-foreground mt-4 text-base">{L.pick(post.excerpt_en, post.excerpt_bn)}</p>}
      <div className="prose prose-neutral mt-6 max-w-none text-sm leading-relaxed [&_a]:underline [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_p]:my-2">
        <Markdown>{body}</Markdown>
      </div>
      {related.length > 0 && (
        <section className="mt-10">
          <SectionHeading title={L.t("catalog.related")} />
          <ProductGrid products={related} eager={0} />
        </section>
      )}
    </article>
  );
}
