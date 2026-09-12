import { headers } from "next/headers";
import Link from "next/link";
import { permanentRedirect, redirect } from "next/navigation";
import { resolveRedirect } from "@/lib/seo/redirects";

/**
 * 404 handler with redirect lookup (BUILD_PROMPT §7.6): before rendering the
 * not-found page, check the redirects table for the requested path (set on the
 * x-pathname header by middleware). 301/302 redirect, 410 renders "gone".
 */
export default async function NotFound() {
  const h = await headers();
  const path = h.get("x-pathname");
  let gone = false;
  if (path) {
    const r = await resolveRedirect(path).catch(() => null);
    if (r?.status_code === 301) permanentRedirect(r.to_path);
    if (r?.status_code === 302) redirect(r.to_path);
    if (r?.status_code === 410) gone = true;
  }
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-amber-deep text-xs font-semibold tracking-wide uppercase">{gone ? "410" : "404"}</p>
      <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{gone ? "This page has been removed" : "Page not found"}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{gone ? "The product or page you followed a link to is no longer available." : "The link may be old or mistyped. Try searching for what you need."}</p>
      <div className="mt-6 flex gap-2">
        <Link href="/" className="bg-amber text-ink rounded-2xl px-5 py-2.5 text-sm font-semibold">Go to the home page</Link>
        <Link href="/search" className="rounded-2xl border px-5 py-2.5 text-sm font-semibold">Search</Link>
      </div>
    </main>
  );
}
