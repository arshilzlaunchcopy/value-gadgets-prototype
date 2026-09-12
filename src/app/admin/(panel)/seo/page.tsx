import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { formatDateTime } from "@/lib/format";
import { listSeoEntities } from "@/lib/seo/audit";
import { getSeoSettings } from "@/lib/seo/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { SeoDefaultsForm } from "./defaults-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "SEO Center" };

/** SEO Center overview (BUILD_PROMPT §7.10): defaults, completeness, feed status, tools. */
export default async function SeoCenterPage() {
  const admin = createAdminClient();
  const [seo, entities, { data: feeds }, { count: redirects }, { data: events }] = await Promise.all([
    getSeoSettings(),
    listSeoEntities(),
    admin.from("settings").select("value").eq("key", "feeds_status").maybeSingle(),
    admin.from("redirects").select("id", { count: "exact", head: true }).eq("is_active", true),
    admin.from("analytics_events").select("provider, event_name, status, created_at").order("created_at", { ascending: false }).limit(5),
  ]);
  const byKind = new Map<string, { n: number; score: number; explicit: number }>();
  for (const e of entities) {
    const k = byKind.get(e.kind) ?? { n: 0, score: 0, explicit: 0 };
    k.n++;
    k.score += e.score;
    if (e.titleSource === "explicit") k.explicit++;
    byKind.set(e.kind, k);
  }
  const avg = entities.length ? Math.round(entities.reduce((n, e) => n + e.score, 0) / entities.length) : 0;
  const fs = (feeds?.value ?? {}) as Record<string, { generated_at: string; items: number; bytes: number }>;

  const tools = [
    { href: "/admin/seo/entities", label: "Indexable entities", desc: `${entities.length} pages · average completeness ${avg}%` },
    { href: "/admin/seo/redirects", label: "Redirect manager", desc: `${redirects ?? 0} active redirect(s) · CSV import` },
    { href: "/admin/seo/alt-text", label: "Missing alt-text report", desc: "Product images without useful alt text" },
    { href: "/admin/seo/links", label: "Broken internal link scanner", desc: "Blocks, menus, pages and posts" },
    { href: "/admin/catalog", label: "Categories & collections", desc: "Slugs (auto-301), descriptions, filter indexing" },
  ];

  return (
    <>
      <PageHeader title="SEO Center" description="Metadata fallback chain, structured data, sitemaps, feeds, redirects and tracking - all editable here." />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <section className="bg-paper rounded-2xl border p-4">
            <h2 className="mb-1 font-semibold">Completeness by type</h2>
            <p className="text-muted-foreground mb-3 text-xs">Score: title present and sized, description present and sized, share image. Explicit = set by hand, otherwise generated from the template.</p>
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-left text-xs uppercase"><tr><th className="py-1">Type</th><th className="py-1 text-right">Pages</th><th className="py-1 text-right">Explicit titles</th><th className="py-1 text-right">Avg score</th></tr></thead>
              <tbody>
                {[...byKind.entries()].map(([k, v]) => (
                  <tr key={k} className="border-t">
                    <td className="py-1.5 capitalize"><Link href={`/admin/seo/entities?kind=${k}`} className="hover:underline">{k}</Link></td>
                    <td className="py-1.5 text-right tabular-nums">{v.n}</td>
                    <td className="py-1.5 text-right tabular-nums">{v.explicit}</td>
                    <td className={`py-1.5 text-right tabular-nums font-semibold ${v.score / v.n >= 80 ? "text-success-deep" : v.score / v.n >= 60 ? "text-warn-deep" : "text-danger"}`}>{Math.round(v.score / v.n)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <SeoDefaultsForm initial={seo} />
        </div>
        <aside className="space-y-4">
          <section className="bg-paper rounded-2xl border p-4 text-sm">
            <h2 className="mb-2 font-semibold">Tools</h2>
            <ul className="space-y-2">
              {tools.map((t) => (
                <li key={t.href}>
                  <Link href={t.href} className="hover:bg-accent block rounded-lg border px-3 py-2">
                    <span className="block font-medium">{t.label}</span>
                    <span className="text-muted-foreground text-xs">{t.desc}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section className="bg-paper rounded-2xl border p-4 text-sm">
            <h2 className="mb-2 font-semibold">Feeds & sitemaps</h2>
            <ul className="space-y-1.5 text-xs">
              {(["google_merchant", "facebook_catalog"] as const).map((k) => (
                <li key={k} className="flex items-center justify-between gap-2">
                  <a href={k === "google_merchant" ? "/feeds/google-merchant.xml" : "/feeds/facebook-catalog.csv"} target="_blank" className="underline">{k === "google_merchant" ? "Google Merchant XML" : "Meta catalog CSV"}</a>
                  <span className="text-muted-foreground">{fs[k] ? `${fs[k].items} items · ${formatDateTime(fs[k].generated_at)}` : "not generated yet"}</span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-2">
                <a href="/sitemap.xml" target="_blank" className="underline">Sitemap index</a>
                <span className="text-muted-foreground">products · categories · collections · posts · pages</span>
              </li>
              <li><a href="/robots.txt" target="_blank" className="underline">robots.txt</a></li>
            </ul>
          </section>
          <section className="bg-paper rounded-2xl border p-4 text-sm">
            <h2 className="mb-2 font-semibold">Server-side conversions</h2>
            {events?.length ? (
              <ul className="space-y-1 text-xs">
                {events.map((e, i) => (
                  <li key={i} className="flex justify-between gap-2"><span>{e.provider} · {e.event_name}</span><span className={e.status === "sent" ? "text-success-deep" : "text-danger"}>{e.status} · {formatDateTime(e.created_at)}</span></li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-xs">No purchase events yet.</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
