import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_PATHS = [/^\/admin(\/|$)/, /^\/account(\/|$)/, /^\/checkout$/, /^\/order(\/|$)/];
/** Paths that live outside the [locale] storefront segment. */
const NON_STORE = /^\/(admin|api|demo|preview|lp|feeds|sitemaps?|sitemap-[^/]+\.xml|robots\.txt|favicon\.ico)(\/|$)/;
const LOCALE_COOKIE = "vg_locale";

/**
 * - Locale routing (PART2 §15.3): storefront pages live under app/[locale].
 *   English is the unprefixed canonical URL (rewritten to /en internally);
 *   Bangla has real /bn/... URLs so hreflang can point at them. A visitor whose
 *   cookie says bn gets Bangla at unprefixed URLs (rewrite, not redirect);
 *   crawlers carry no cookie and always see English there.
 * - Refreshes the Supabase session cookie and gates /admin/*.
 * - Assigns the 50/50 A/B cookie for landing pages (PART2 §15.2).
 * - Exposes the requested path to the 404 page for redirect lookup (§7.6).
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
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

  if (!NON_STORE.test(pathname)) {
    const prefixed = /^\/(en|bn)(?=\/|$)/.exec(pathname);
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    if (prefixed) {
      const locale = prefixed[1];
      if (locale === "en") {
        // /en/... is never a public URL: send to the unprefixed canonical and remember the choice
        const url = request.nextUrl.clone();
        url.pathname = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
        const redirect = NextResponse.redirect(url, 307);
        redirect.cookies.set(LOCALE_COOKIE, "en", { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
        return redirect;
      }
      // /bn/... served as-is; sticky preference
      if (cookieLocale !== "bn") response.cookies.set(LOCALE_COOKIE, "bn", { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
      return withAuth(request, response, pathname, search);
    }
    const locale = cookieLocale === "bn" ? "bn" : "en";
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    response = NextResponse.rewrite(url, { request });
  }

  return withAuth(request, response, pathname, search);
}

async function withAuth(request: NextRequest, response: NextResponse, pathname: string, search: string) {
  if (!AUTH_PATHS.some((re) => re.test(pathname.replace(/^\/bn(?=\/|$)/, "")))) return response;

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
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
