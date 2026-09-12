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
import { formatDate } from "@/lib/format";
import { articleJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { getStoreSettings } from "@/lib/settings";
import { createPublicClient } from "@/lib/supabase/public";

export const revalidate = 3600;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return staticParamsSafe("posts", async () => (await listPosts(100)).map((p) => ({ slug: p.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};
  return buildMetadata({ entityType: "post", entityId: post.id, path: `/blog/${post.slug}`, templateVars: { title: post.title_en }, fallbackDescription: post.excerpt_en ?? post.content_en, image: post.cover_image_url ? { url: post.cover_image_url, alt: post.cover_alt ?? post.title_en } : null, ogType: "article", publishedTime: post.published_at, modifiedTime: post.updated_at });
}

/** Blog post with Article JSON-LD (BUILD_PROMPT §7.3) and related products. */
export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const [post, store] = await Promise.all([getPost(slug), getStoreSettings()]);
  if (!post) notFound();
  let related: Awaited<ReturnType<typeof getProductsForSource>> = [];
  if (post.related_product_ids.length) {
    const { data } = await createPublicClient().from("products_public").select("slug").in("id", post.related_product_ids);
    const slugs = (data ?? []).map((p) => p.slug!).filter(Boolean);
    if (slugs.length) related = await getProductsForSource({ source: "manual", slugs, limit: 8 });
  }
  const crumbs = [{ label: "Blog", href: "/blog" }, { label: post.title_en, href: `/blog/${post.slug}` }];
  return (
    <article className="mx-auto max-w-2xl">
      <JsonLd data={[articleJsonLd(post, store), breadcrumbJsonLd(publicEnv.siteUrl, crumbs)]} />
      <Breadcrumbs items={crumbs} />
      <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">{post.title_en}</h1>
      <p className="text-muted-foreground mt-2 text-xs">
        {post.author_name ? `${post.author_name} · ` : ""}{formatDate(post.published_at)} · {post.reading_minutes} min read
      </p>
      {post.cover_image_url && <img src={post.cover_image_url} alt={post.cover_alt ?? ""} className="mt-4 aspect-[16/9] w-full rounded-2xl object-cover" />}
      {post.excerpt_en && <p className="text-muted-foreground mt-4 text-base">{post.excerpt_en}</p>}
      <div className="prose prose-neutral mt-6 max-w-none text-sm leading-relaxed [&_a]:underline [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_p]:my-2">
        <Markdown>{post.content_en ?? ""}</Markdown>
      </div>
      {related.length > 0 && (
        <section className="mt-10">
          <SectionHeading title="Products mentioned" />
          <ProductGrid products={related} eager={0} />
        </section>
      )}
    </article>
  );
}
