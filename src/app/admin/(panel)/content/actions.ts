"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/admin";
import { pageSchema, postSchema } from "@/lib/content/schema";
import { recordSlugRedirect } from "@/lib/seo/redirects";
import { createAdminClient } from "@/lib/supabase/admin";

type R<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };
const fail = (e: unknown): R<never> => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

function bust(path?: string) {
  revalidateTag("pages");
  revalidateTag("layout");
  revalidateTag("seo");
  if (path) revalidatePath(path);
  revalidatePath("/admin/content");
}

export async function savePageAction(raw: unknown): Promise<R<{ id: string }>> {
  try {
    const s = await requireAdmin();
    const p = pageSchema.parse(raw);
    const admin = createAdminClient();
    const row = { slug: p.slug, title_en: p.title_en, title_bn: p.title_bn || null, content_en: p.content_en || null, content_bn: p.content_bn || null, is_published: p.is_published, show_in_footer: p.show_in_footer, position: p.position, updated_by: s.userId };
    let id = p.id;
    let oldSlug: string | null = null;
    if (id) {
      const { data: prev } = await admin.from("pages").select("slug").eq("id", id).maybeSingle();
      oldSlug = prev?.slug ?? null;
      const { error } = await admin.from("pages").update(row).eq("id", id);
      if (error) return { ok: false, error: error.code === "23505" ? "That slug is already used" : error.message };
    } else {
      const { data, error } = await admin.from("pages").insert(row).select("id").single();
      if (error) return { ok: false, error: error.code === "23505" ? "That slug is already used" : error.message };
      id = data.id;
    }
    if (oldSlug && oldSlug !== p.slug) {
      await recordSlugRedirect("page", oldSlug, p.slug);
      revalidatePath(`/pages/${oldSlug}`);
    }
    await audit(s, p.id ? "page.update" : "page.create", { type: "page", id, after: { slug: p.slug, title_en: p.title_en } });
    bust(`/pages/${p.slug}`);
    return { ok: true, data: { id: id! }, message: "Page saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function deletePageAction(idRaw: string): Promise<R> {
  try {
    const s = await requireAdmin("manager");
    const id = z.string().uuid().parse(idRaw);
    const admin = createAdminClient();
    const { data: prev } = await admin.from("pages").select("slug, title_en").eq("id", id).maybeSingle();
    const { error } = await admin.from("pages").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    await audit(s, "page.delete", { type: "page", id, before: prev });
    bust(prev ? `/pages/${prev.slug}` : undefined);
    return { ok: true, message: "Deleted" };
  } catch (e) {
    return fail(e);
  }
}

export async function savePostAction(raw: unknown): Promise<R<{ id: string }>> {
  try {
    const s = await requireAdmin();
    const p = postSchema.parse(raw);
    const admin = createAdminClient();
    const row = {
      slug: p.slug,
      title_en: p.title_en,
      excerpt_en: p.excerpt_en || null,
      content_en: p.content_en || null,
      title_bn: p.title_bn || null,
      excerpt_bn: p.excerpt_bn || null,
      content_bn: p.content_bn || null,
      cover_image_url: p.cover_image_url || null,
      cover_alt: p.cover_alt || null,
      author_name: p.author_name || null,
      reading_minutes: p.reading_minutes,
      status: p.status,
      related_product_ids: p.related_product_ids,
      updated_by: s.userId,
    };
    let id = p.id;
    let oldSlug: string | null = null;
    if (id) {
      const { data: prev } = await admin.from("posts").select("slug, published_at").eq("id", id).maybeSingle();
      oldSlug = prev?.slug ?? null;
      const { error } = await admin.from("posts").update({ ...row, published_at: p.status === "published" ? (prev?.published_at ?? new Date().toISOString()) : prev?.published_at ?? null }).eq("id", id);
      if (error) return { ok: false, error: error.code === "23505" ? "That slug is already used" : error.message };
    } else {
      const { data, error } = await admin.from("posts").insert({ ...row, published_at: p.status === "published" ? new Date().toISOString() : null }).select("id").single();
      if (error) return { ok: false, error: error.code === "23505" ? "That slug is already used" : error.message };
      id = data.id;
    }
    if (oldSlug && oldSlug !== p.slug) {
      await recordSlugRedirect("post", oldSlug, p.slug);
      revalidatePath(`/blog/${oldSlug}`);
    }
    await audit(s, p.id ? "post.update" : "post.create", { type: "post", id, after: { slug: p.slug, title_en: p.title_en, status: p.status } });
    bust(`/blog/${p.slug}`);
    revalidatePath("/blog");
    return { ok: true, data: { id: id! }, message: "Post saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function deletePostAction(idRaw: string): Promise<R> {
  try {
    const s = await requireAdmin("manager");
    const id = z.string().uuid().parse(idRaw);
    const admin = createAdminClient();
    const { data: prev } = await admin.from("posts").select("slug, title_en").eq("id", id).maybeSingle();
    const { error } = await admin.from("posts").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    await audit(s, "post.delete", { type: "post", id, before: prev });
    bust(prev ? `/blog/${prev.slug}` : undefined);
    revalidatePath("/blog");
    return { ok: true, message: "Deleted" };
  } catch (e) {
    return fail(e);
  }
}
