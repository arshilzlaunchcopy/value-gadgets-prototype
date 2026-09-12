"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { formatBDT } from "@/lib/format";

interface Stats {
  range: { days: number; from: string; to: string };
  current: { revenue_bdt: number; orders: number; cod_orders: number; online_orders: number; cod_revenue_bdt: number; online_revenue_bdt: number; cancelled: number; returned: number; delivered: number };
  previous: { revenue_bdt: number; orders: number };
  aov_bdt: number;
  carts: number;
  pending_review: number;
  low_stock_count: number;
  low_stock: { variant_id: string; title_en: string; slug: string; sku: string; option_value: string | null; stock_qty: number; low_stock_threshold: number }[];
  top_products: { product_id: string | null; product_title: string; qty: number; revenue_bdt: number }[];
  series: { date: string; revenue_bdt: number; orders: number }[];
}

const RANGES = [
  { days: 1, label: "Today" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
];

function delta(cur: number, prev: number): string | null {
  if (!prev) return null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string | null; tone?: "up" | "down" }) {
  return (
    <div className="bg-paper rounded-2xl border p-4">
      <p className="text-muted-foreground text-xs font-medium uppercase">{label}</p>
      <p className="price mt-1 text-2xl">{value}</p>
      {sub && <p className={`mt-0.5 text-xs ${tone === "up" ? "text-success-deep" : tone === "down" ? "text-danger" : "text-muted-foreground"}`}>{sub}</p>}
    </div>
  );
}

/** Dashboard (BUILD_PROMPT §6.2): range toggle, KPIs, sparkline, split, low stock, top products. */
export function Dashboard() {
  const [days, setDays] = useState(7);
  const { data, isLoading, error } = useQuery<Stats>({
    queryKey: ["admin-stats", days],
    queryFn: async () => {
      const r = await fetch(`/api/admin/stats?days=${days}`, { cache: "no-store" });
      if (!r.ok) throw new Error("Could not load stats");
      return r.json();
    },
  });

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-lg border p-0.5" role="group" aria-label="Range">
        {RANGES.map((r) => (
          <button key={r.days} type="button" onClick={() => setDays(r.days)} aria-pressed={days === r.days} className={`rounded-md px-3 py-1.5 text-sm ${days === r.days ? "bg-ink text-paper" : "hover:bg-accent"}`}>
            {r.label}
          </button>
        ))}
      </div>

      {error && <p className="text-danger text-sm">{String(error)}</p>}
      {isLoading || !data ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Revenue" value={formatBDT(data.current.revenue_bdt)} sub={delta(data.current.revenue_bdt, data.previous.revenue_bdt) ? `${delta(data.current.revenue_bdt, data.previous.revenue_bdt)} vs previous period` : "no previous data"} tone={data.current.revenue_bdt >= data.previous.revenue_bdt ? "up" : "down"} />
            <Kpi label="Orders" value={String(data.current.orders)} sub={delta(data.current.orders, data.previous.orders) ? `${delta(data.current.orders, data.previous.orders)} vs previous period` : null} tone={data.current.orders >= data.previous.orders ? "up" : "down"} />
            <Kpi label="Average order value" value={formatBDT(data.aov_bdt)} sub={`${data.current.delivered} delivered · ${data.current.cancelled} cancelled · ${data.current.returned} returned`} />
            <Kpi label="Conversion" value={data.carts ? `${Math.min(100, Math.round((data.current.orders / data.carts) * 100))}%` : "—"} sub={`${data.current.orders} orders / ${data.carts} carts started`} />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="bg-paper rounded-2xl border p-4 lg:col-span-2">
              <p className="mb-2 text-sm font-semibold">Revenue by day</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.series} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FFC107" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#FFC107" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#E8E8E8" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(d: string) => String(d).slice(5, 10)} tick={{ fontSize: 11 }} minTickGap={24} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} width={40} />
                    <Tooltip formatter={(v) => formatBDT(Number(v))} labelFormatter={(l) => String(l).slice(0, 10)} />
                    <Area type="monotone" dataKey="revenue_bdt" name="Revenue" stroke="#E8A800" fill="url(#rev)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-paper rounded-2xl border p-4">
              <p className="mb-2 text-sm font-semibold">COD vs online</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[{ name: "COD", orders: data.current.cod_orders, revenue: data.current.cod_revenue_bdt }, { name: "Online", orders: data.current.online_orders, revenue: data.current.online_revenue_bdt }]} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid stroke="#E8E8E8" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={30} />
                    <Tooltip />
                    <Bar dataKey="orders" name="Orders" fill="#1A1A1A" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                COD {formatBDT(data.current.cod_revenue_bdt)} · Online {formatBDT(data.current.online_revenue_bdt)}
              </p>
              <Link href="/admin/orders?review=1" className="mt-3 flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-accent">
                Pending review
                <Badge className={`rounded-lg ${data.pending_review ? "bg-amber text-ink" : ""}`}>{data.pending_review}</Badge>
              </Link>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="bg-paper rounded-2xl border p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">Low stock ({data.low_stock_count})</p>
                <Link href="/admin/inventory" className="text-xs underline">Inventory</Link>
              </div>
              {data.low_stock.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nothing below threshold.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {data.low_stock.map((l) => (
                    <li key={l.variant_id} className="flex items-center justify-between gap-2 py-1.5">
                      <span className="min-w-0 truncate">
                        {l.title_en}
                        {l.option_value ? ` · ${l.option_value}` : ""} <span className="text-muted-foreground text-xs">{l.sku}</span>
                      </span>
                      <Badge className={`rounded-lg ${l.stock_qty === 0 ? "bg-danger text-paper" : "bg-warn text-ink"}`}>{l.stock_qty}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="bg-paper rounded-2xl border p-4">
              <p className="mb-2 text-sm font-semibold">Top products</p>
              {data.top_products.length === 0 ? (
                <p className="text-muted-foreground text-sm">No sales in this range.</p>
              ) : (
                <ol className="divide-y text-sm">
                  {data.top_products.map((p, i) => (
                    <li key={`${p.product_id}-${i}`} className="flex items-center justify-between gap-2 py-1.5">
                      <span className="min-w-0 truncate">
                        <span className="text-muted-foreground mr-2 tabular-nums">{i + 1}.</span>
                        {p.product_title}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums">
                        {p.qty} sold · {formatBDT(p.revenue_bdt)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
