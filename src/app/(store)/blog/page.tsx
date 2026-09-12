/* eslint-disable @next/next/no-img-element -- post covers from the media library */
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/store/breadcrumbs";
import { listPosts } from "@/lib/content/queries";
import { publicEnv } from "@/lib/env.public";
import { formatDate } from "@/lib/format";
import { buildMetadata } from "@/lib/seo/metadata";
import { getStoreSettings } from "@/lib/settings";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStoreSettings();
  return buildMetadata({ entityType: "page", entityId: null, path: "/blog", templateVars: { title: "Blog" }, fallbackDescription: `Buying guides, comparisons and how-tos from ${store.name}.` });
}

export default async function BlogIndex() {
  const posts = await listPosts();
  const crumbs = [{ label: "Blog", href: "/blog" }];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(publicEnv.siteUrl, crumbs)} />
      <Breadcrumbs items={crumbs} />
      <h1 className="mb-6 text-2xl font-semibold sm:text-3xl">Blog</h1>
      {posts.length === 0 ? (
        <p className="text-muted-foreground">No posts yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <li key={p.id} className="bg-paper overflow-hidden rounded-2xl border">
              <Link href={`/blog/${p.slug}`} className="block">
                {p.cover_image_url ? <img src={p.cover_image_url} alt={p.cover_alt ?? ""} className="aspect-[16/9] w-full object-cover" loading="lazy" /> : <div className="bg-paper-line aspect-[16/9]" aria-hidden="true" />}
                <div className="p-4">
                  <h2 className="font-semibold leading-snug">{p.title_en}</h2>
                  {p.excerpt_en && <p className="text-muted-foreground mt-1 line-clamp-3 text-sm">{p.excerpt_en}</p>}
                  <p className="text-muted-foreground mt-2 text-xs">
                    {formatDate(p.published_at)} · {p.reading_minutes} min read
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
