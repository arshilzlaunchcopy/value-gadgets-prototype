import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_PATHS = [/^\/admin(\/|$)/, /^\/account(\/|$)/, /^\/checkout$/, /^\/order(\/|$)/];

/**
 * - Refreshes the Supabase session cookie and gates /admin/* behind a signed-in
 *   user (the admin_users check happens in the admin layout with RLS).
 * - Assigns the 50/50 A/B cookie for landing pages (PART2 §15.2).
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // the 404 page reads the requested path from this header to consult the redirects table (§7.6)
  request.headers.set("x-pathname", pathname);
  let response = NextResponse.next({ request });

  // Landing page A/B split: one sticky cookie per slug, set before any render.
  const lp = /^\/lp\/([a-z0-9-]+)\/?$/i.exec(pathname);
  if (lp) {
    const name = `vg_ab_${lp[1].replace(/[^a-z0-9-]/gi, "")}`;
    if (!request.cookies.get(name)) {
      const variant = Math.random() < 0.5 ? "a" : "b";
      request.cookies.set(name, variant);
      response = NextResponse.next({ request });
      response.cookies.set(name, variant, { path: `/lp/${lp[1]}`, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
    }
    return response;
  }

  if (!AUTH_PATHS.some((re) => re.test(pathname))) return response;

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdminArea = pathname.startsWith("/admin") && pathname !== "/admin/login";
  if (isAdminArea && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  if (pathname === "/admin/login" && user) {
    const next = request.nextUrl.searchParams.get("next");
    const url = request.nextUrl.clone();
    url.pathname = next && next.startsWith("/admin") ? next.split("?")[0] : "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // every page route; skips Next internals, API routes, feeds, sitemaps and static files
  matcher: ["/((?!_next/|api/|feeds/|sitemaps?/|sitemap[^/]*\\.xml|robots\\.txt|favicon\\.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
