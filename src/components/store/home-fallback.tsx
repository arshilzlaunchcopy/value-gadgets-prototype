import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getHomeData, getNavCategories } from "@/lib/catalog/queries";
import { tFor, type Locale } from "@/lib/i18n/messages";
import { getPublicSettings } from "@/lib/settings";
import { ProductGrid, SectionHeading } from "./product-grid";
import { TrustStrip } from "./trust-strip";

/** Rendered when no home-page blocks are published yet (before the seed / after a wipe). */
export async function HomeFallback({ locale = "en" }: { locale?: Locale }) {
  const t = tFor(locale);
  const [{ hero, trust_badges, store }, categories, home] = await Promise.all([getPublicSettings(), getNavCategories(), getHomeData()]);
  const top = categories.filter((c) => !c.parent_id);
  return (
    <div className="space-y-10">
      <section className="bg-ink text-paper relative overflow-hidden rounded-2xl px-6 py-10 sm:px-10 sm:py-14">
        <div className="bg-gradient-brand absolute -top-24 -right-24 size-64 rounded-full opacity-20 blur-3xl" aria-hidden="true" />
        <p className="text-amber text-xs font-semibold tracking-wide uppercase">{store.name}</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">{hero.heading}</h1>
        <p className="text-paper/80 mt-3 max-w-xl text-sm sm:text-base">{hero.subheading}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild className="rounded-2xl">
            <Link href={hero.cta_href}>{hero.cta_label}</Link>
          </Button>
          <Button asChild variant="outline" className="border-ink-line text-paper hover:bg-ink-soft hover:text-paper rounded-2xl bg-transparent">
            <Link href={hero.secondary_href}>{hero.secondary_label}</Link>
          </Button>
        </div>
      </section>
      <section aria-labelledby="cats">
        <h2 id="cats" className="sr-only">{t("nav.categories")}</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {top.map((c) => (
            <li key={c.id}>
              <Link href={`/category/${c.slug}`} className="bg-paper hover:ring-amber block rounded-2xl border p-3 text-center text-sm font-medium ring-2 ring-transparent transition">
                {(locale === "bn" && c.name_bn) || c.name_en}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <SectionHeading title={locale === "bn" ? "বাছাই করা" : "Featured"} href="/collection/best-sellers" hrefLabel={t("catalog.view_all")} />
        <ProductGrid products={home.featured} eager={4} locale={locale} />
      </section>
      <TrustStrip badges={trust_badges} />
      <section>
        <SectionHeading title={locale === "bn" ? "নতুন পণ্য" : "New arrivals"} href="/collection/new-arrivals" hrefLabel={t("catalog.view_all")} />
        <ProductGrid products={home.newest} eager={0} locale={locale} />
      </section>
    </div>
  );
}
