import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/store/header";
import { BlockRenderer } from "@/lib/blocks/render";
import { publicEnv } from "@/lib/env.public";
import { LOCALE_COOKIE } from "@/lib/i18n/messages";
import { abCookieName, getLandingPage, type AbVariant } from "@/lib/landing/queries";
import { getStoreSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { LandingPixel } from "./pixel";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [lp, store] = await Promise.all([getLandingPage(slug), getStoreSettings()]);
  if (!lp) return {};
  return {
    title: lp.meta_title || lp.title,
    description: lp.meta_description || `${lp.title} - ${store.tagline}`,
    alternates: { canonical: `/lp/${lp.slug}` },
    openGraph: { title: lp.meta_title || lp.title, description: lp.meta_description || undefined, images: lp.og_image_url ? [{ url: lp.og_image_url }] : undefined, url: `/lp/${lp.slug}` },
    robots: { index: true, follow: true },
  };
}

/**
 * /lp/{slug} (PART2 §15.2). Variant: ?variant=a|b override (for previews and
 * ad links) else the 50/50 cookie the middleware assigned. Views are counted
 * per variant; conversions come from orders.ab_variant.
 */
export default async function LandingPage({ params, searchParams }: Props) {
  const [{ slug }, sp, store] = await Promise.all([params, searchParams, getStoreSettings()]);
  const lp = await getLandingPage(slug);
  if (!lp) notFound();
  const jar = await cookies();
  const forced = sp.variant === "b" ? "b" : sp.variant === "a" ? "a" : null;
  const cookieVariant = jar.get(abCookieName(slug))?.value;
  const variant: AbVariant = !lp.ab_enabled ? "a" : (forced ?? (cookieVariant === "b" ? "b" : "a"));
  const targetId = variant === "b" ? lp.variant_b_id : lp.id;
  const locale = jar.get(LOCALE_COOKIE)?.value === "bn" ? "bn" : "en";
  if (!forced) createAdminClient().rpc("increment_landing_view", { p_id: lp.id, p_variant: variant }).then(() => undefined, () => undefined);

  return (
    <div className="flex min-h-dvh flex-col" data-landing={lp.slug} data-variant={variant}>
      <LandingPixel event={lp.pixel_event} slug={lp.slug} variant={variant} />
      {lp.chrome === "minimal" && (
        <div className="bg-ink text-paper">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-2.5">
            <Logo store={store} />
            {store.phone && (
              <a href={`tel:${store.phone}`} className="text-sm font-medium">
                {store.phone}
              </a>
            )}
          </div>
        </div>
      )}
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        <h1 className="sr-only">{lp.title}</h1>
        <BlockRenderer pageType="landing" targetId={targetId} locale={locale} fallback={<p className="text-muted-foreground py-16 text-center">This page has no content yet.</p>} />
      </main>
      <footer className="text-muted-foreground mx-auto w-full max-w-4xl px-4 py-6 text-center text-xs">
        <p>
          {store.name}
          {store.trade_license ? ` · Trade licence ${store.trade_license}` : ""}
        </p>
        <p className="mt-1 space-x-3">
          <Link href="/pages/terms" className="underline">Terms</Link>
          <Link href="/pages/refund" className="underline">Returns</Link>
          <Link href="/" className="underline">Full store</Link>
        </p>
        {publicEnv.demoMode && <p className="mt-1">Variant {variant.toUpperCase()}</p>}
      </footer>
    </div>
  );
}
