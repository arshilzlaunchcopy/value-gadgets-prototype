import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { formatBDT, formatDate } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discounts" };

/** Coupons with redemption stats (BUILD_PROMPT §6.2). */
export default async function DiscountsPage() {
  const admin = createAdminClient();
  const [{ data: coupons }, { data: redemptions }] = await Promise.all([
    admin.from("coupons").select("id, code, description, type, value, min_order_bdt, usage_limit, times_used, starts_at, ends_at, is_active, updated_at").order("created_at", { ascending: false }),
    admin.from("coupon_redemptions").select("coupon_id, discount_bdt, orders(total_bdt, status)"),
  ]);
  const stats = new Map<string, { uses: number; discount: number; revenue: number }>();
  for (const r of redemptions ?? []) {
    const s = stats.get(r.coupon_id) ?? { uses: 0, discount: 0, revenue: 0 };
    const o = r.orders as { total_bdt: number; status: string } | null;
    s.uses++;
    s.discount += r.discount_bdt;
    if (o && !["cancelled", "returned", "refunded"].includes(o.status)) s.revenue += o.total_bdt;
    stats.set(r.coupon_id, s);
  }
  const label = (c: { type: string; value: number }) => (c.type === "percentage" ? `${c.value}% off` : c.type === "fixed" ? `${formatBDT(c.value)} off` : "Free delivery");
  const now = Date.now();
  const state = (c: { is_active: boolean; starts_at: string | null; ends_at: string | null; usage_limit: number | null; times_used: number }) =>
    !c.is_active ? "inactive" : c.ends_at && new Date(c.ends_at).getTime() < now ? "expired" : c.starts_at && new Date(c.starts_at).getTime() > now ? "scheduled" : c.usage_limit !== null && c.times_used >= c.usage_limit ? "exhausted" : "live";

  return (
    <>
      <PageHeader title="Discounts" description="Coupon codes with a live preview on a sample cart and redemption stats." actions={<Button asChild className="rounded-lg"><Link href="/admin/discounts/new">New coupon</Link></Button>} />
      <div className="bg-paper overflow-x-auto rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-paper-soft text-left text-xs uppercase"><tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Discount</th><th className="px-3 py-2">State</th><th className="px-3 py-2 text-right">Uses</th><th className="px-3 py-2 text-right">Discount given</th><th className="px-3 py-2 text-right">Revenue on coupon orders</th><th className="px-3 py-2">Window</th></tr></thead>
          <tbody>
            {(coupons ?? []).map((c) => {
              const s = stats.get(c.id) ?? { uses: 0, discount: 0, revenue: 0 };
              const st = state(c);
              return (
                <tr key={c.id} className="border-t">
                  <td className="px-3 py-2">
                    <Link href={`/admin/discounts/${c.id}`} className="font-mono font-semibold hover:underline">{c.code}</Link>
                    {c.description && <span className="text-muted-foreground block text-xs">{c.description}</span>}
                  </td>
                  <td className="px-3 py-2">{label(c)}{c.min_order_bdt > 0 ? <span className="text-muted-foreground block text-xs">min {formatBDT(c.min_order_bdt)}</span> : null}</td>
                  <td className="px-3 py-2"><span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${st === "live" ? "bg-success/15 text-success-deep" : "bg-muted"}`}>{st}</span></td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.times_used}{c.usage_limit !== null ? ` / ${c.usage_limit}` : ""}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBDT(s.discount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBDT(s.revenue)}</td>
                  <td className="px-3 py-2 text-xs">{c.starts_at ? formatDate(c.starts_at) : "now"} → {c.ends_at ? formatDate(c.ends_at) : "no end"}</td>
                </tr>
              );
            })}
            {(coupons ?? []).length === 0 && <tr><td colSpan={7} className="text-muted-foreground px-3 py-8 text-center">No coupons yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
