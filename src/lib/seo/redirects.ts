import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export interface ResolvedRedirect {
  to_path: string;
  status_code: 301 | 302 | 410;
}

/** Normalise a request path for matching: no trailing slash (except root), no query. */
export function normalizePath(path: string): string {
  const p = path.split("?")[0].split("#")[0] || "/";
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

/**
 * Redirect lookup on the 404 path (BUILD_PROMPT §7.6). Counts hits so the admin
 * can see which redirects matter. Tries the exact path, then the lower-case form.
 */
export async function resolveRedirect(rawPath: string): Promise<ResolvedRedirect | null> {
  const path = normalizePath(rawPath);
  const admin = createAdminClient();
  const { data } = await admin.from("redirects").select("id, to_path, status_code, hit_count").eq("is_active", true).in("from_path", [path, path.toLowerCase()]).limit(1).maybeSingle();
  if (!data) return null;
  admin
    .from("redirects")
    .update({ hit_count: data.hit_count + 1, last_hit_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => undefined, () => undefined);
  return { to_path: data.to_path, status_code: data.status_code as 301 | 302 | 410 };
}

const PATH_FOR: Record<string, (slug: string) => string> = {
  product: (s) => `/products/${s}`,
  category: (s) => `/category/${s}`,
  collection: (s) => `/collection/${s}`,
  page: (s) => `/pages/${s}`,
  post: (s) => `/blog/${s}`,
  landing: (s) => `/lp/${s}`,
};

/** Auto-301 when an admin changes a slug (§7.6). Also repoints any redirect that targeted the old path. */
export async function recordSlugRedirect(kind: keyof typeof PATH_FOR, oldSlug: string, newSlug: string): Promise<void> {
  if (!oldSlug || oldSlug === newSlug) return;
  const from = PATH_FOR[kind](oldSlug);
  const to = PATH_FOR[kind](newSlug);
  const admin = createAdminClient();
  await admin.from("redirects").upsert({ from_path: from, to_path: to, status_code: 301, is_active: true }, { onConflict: "from_path" });
  await admin.from("redirects").update({ to_path: to }).eq("to_path", from);
  // a redirect from the new path back to the old one would loop
  await admin.from("redirects").delete().eq("from_path", to);
}
