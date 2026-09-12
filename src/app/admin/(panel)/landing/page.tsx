import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { formatBDT, formatDate } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Landing pages" };

/** Landing page list with per-variant views, orders and conversion (PART2 §15.2). */
export default async function LandingPagesPage() {
  const admin = createAdminClient();
  const [{ data: pages }, { data: orders }] = await Promise.all([
    admin.from("landing_pages").select("id, slug, title, status, ab_enabled, otp_mode, views_a, views_b, updated_at, products(title_en)").order("updated_at", { ascending: false }),
    admin.from("orders").select("landing_page_id, ab_variant, total_bdt, status").not("landing_page_id", "is", null),
  ]);
  const stats = new Map<string, { a: { orders: number; revenue: number }; b: { orders: number; revenue: number } }>();
  for (const o of orders ?? []) {
    if (!o.landing_page_id) continue;
    const s = stats.get(o.landing_page_id) ?? { a: { orders: 0, revenue: 0 }, b: { orders: 0, revenue: 0 } };
    const v = o.ab_variant === "b" ? s.b : s.a;
    v.orders++;
    if (!["cancelled", "returned", "refunded"].includes(o.status)) v.revenue += o.total_bdt;
    stats.set(o.landing_page_id, s);
  }
  const pct = (orders: number, views: number) => (views ? `${((orders / views) * 100).toFixed(1)}%` : "—");

  return (
    <>
      <PageHeader title="Landing pages" description="Facebook-traffic pages built from blocks: own URL, no chrome, quick order form, optional OTP, A/B split." actions={<Button asChild className="rounded-lg"><Link href="/admin/landing/new">New landing page</Link></Button>} />
      <div className="bg-paper overflow-x-auto rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-paper-soft text-left text-xs uppercase">
            <tr>
              <th className="px-3 py-2">Page</th>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">OTP</th>
              <th className="px-3 py-2 text-right">Views A / B</th>
              <th className="px-3 py-2 text-right">Orders A / B</th>
              <th className="px-3 py-2 text-right">Conversion A / B</th>
              <th className="px-3 py-2 text-right">Revenue</th>
              <th className="px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {(pages ?? []).length === 0 && (
              <tr><td colSpan={9} className="text-muted-foreground px-3 py-8 text-center">No landing pages yet.</td></tr>
            )}
            {(pages ?? []).map((p) => {
              const s = stats.get(p.id) ?? { a: { orders: 0, revenue: 0 }, b: { orders: 0, revenue: 0 } };
              return (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2">
                    <Link href={`/admin/landing/${p.id}`} className="font-medium hover:underline">{p.title}</Link>
                    <span className="text-muted-foreground block text-xs">/lp/{p.slug}</span>
                  </td>
                  <td className="px-3 py-2 text-xs">{(p.products as { title_en: string } | null)?.title_en ?? "—"}</td>
                  <td className="px-3 py-2"><span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${p.status === "published" ? "bg-success/15 text-success-deep" : "bg-muted"}`}>{p.status}</span>{p.ab_enabled && <span className="bg-amber text-ink ml-1 rounded-lg px-2 py-0.5 text-xs font-semibold">A/B</span>}</td>
                  <td className="px-3 py-2 text-xs">{p.otp_mode.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.views_a} / {p.views_b}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.a.orders} / {s.b.orders}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pct(s.a.orders, p.views_a)} / {pct(s.b.orders, p.views_b)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBDT(s.a.revenue + s.b.revenue)}</td>
                  <td className="px-3 py-2 text-xs">{formatDate(p.updated_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
