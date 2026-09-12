import "server-only";

import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

export const PAGES_TAG = "pages";

export interface PagePublic {
  id: string;
  slug: string;
  title_en: string;
  title_bn: string | null;
  content_en: string | null;
  content_bn: string | null;
  position: number;
  show_in_footer: boolean;
  updated_at: string;
}

export interface PostPublic {
  id: string;
  slug: string;
  title_en: string;
  excerpt_en: string | null;
  content_en: string | null;
  title_bn: string | null;
  excerpt_bn: string | null;
  content_bn: string | null;
  cover_image_url: string | null;
  cover_alt: string | null;
  author_name: string | null;
  reading_minutes: number;
  published_at: string | null;
  related_product_ids: string[];
  updated_at: string;
}

const PAGE_COLS = "id, slug, title_en, title_bn, content_en, content_bn, position, show_in_footer, updated_at";
const POST_COLS = "id, slug, title_en, excerpt_en, content_en, title_bn, excerpt_bn, content_bn, cover_image_url, cover_alt, author_name, reading_minutes, published_at, related_product_ids, updated_at";

export const getPage = unstable_cache(
  async (slug: string): Promise<PagePublic | null> => {
    const { data } = await createPublicClient().from("pages").select(PAGE_COLS).eq("slug", slug).eq("is_published", true).maybeSingle();
    return (data as PagePublic | null) ?? null;
  },
  ["page"],
  { revalidate: 3600, tags: [PAGES_TAG] },
);

export const getFooterPages = unstable_cache(
  async (): Promise<Pick<PagePublic, "slug" | "title_en" | "title_bn">[]> => {
    const { data } = await createPublicClient().from("pages").select("slug, title_en, title_bn").eq("is_published", true).eq("show_in_footer", true).order("position");
    return data ?? [];
  },
  ["footer-pages"],
  { revalidate: 3600, tags: [PAGES_TAG, "layout"] },
);

export const getPost = unstable_cache(
  async (slug: string): Promise<PostPublic | null> => {
    const { data } = await createPublicClient().from("posts").select(POST_COLS).eq("slug", slug).eq("status", "published").maybeSingle();
    return (data as PostPublic | null) ?? null;
  },
  ["post"],
  { revalidate: 3600, tags: [PAGES_TAG] },
);

export const listPosts = unstable_cache(
  async (limit = 24): Promise<PostPublic[]> => {
    const { data } = await createPublicClient().from("posts").select(POST_COLS).eq("status", "published").order("published_at", { ascending: false, nullsFirst: false }).limit(limit);
    return (data ?? []) as PostPublic[];
  },
  ["posts"],
  { revalidate: 3600, tags: [PAGES_TAG] },
);
