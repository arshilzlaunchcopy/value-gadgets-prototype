"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  courierTick,
  firePaymentIpn,
  forceIntoReviewQueue,
  forceOrderStatus,
  generateDemoOrders,
  jumpClock,
  resetAllData,
  resetTransactionalData,
  runFullLifecycle,
  seedEverything,
  triggerReturn,
  updateDemoSettings,
  type ActionResult,
  type IpnKind,
} from "@/app/demo/actions";
import type { PanelData, PanelOrder } from "@/app/demo/data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ORDER_STATUSES = ["pending_payment", "awaiting_advance", "confirmed", "processing", "packed", "shipped", "delivered", "cancelled", "returned", "refunded"] as const;

function money(n: number) {
  return `৳${n.toLocaleString("en-IN")}`;
}

function StatusBadge({ value }: { value: string }) {
  const tone =
    value === "delivered" || value === "paid" || value === "live"
      ? "bg-success/15 text-success"
      : value === "cancelled" || value === "returned" || value === "failed"
        ? "bg-danger/15 text-danger"
        : value === "mock"
          ? "bg-amber/20 text-ink"
          : "bg-muted text-muted-foreground";
  return <Badge className={`${tone} rounded-lg border-0 font-medium`}>{value.replace(/_/g, " ")}</Badge>;
}

export function DemoPanel({ data }: { data: PanelData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [orderId, setOrderId] = useState<string>(data.orders[0]?.id ?? "");
  const [n, setN] = useState(20);
  const [days, setDays] = useState(7);
  const [lifecycleRunning, setLifecycleRunning] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const order: PanelOrder | undefined = useMemo(() => data.orders.find((o) => o.id === orderId), [data.orders, orderId]);

  useEffect(() => {
    if (!orderId && data.orders[0]) setOrderId(data.orders[0].id);
  }, [data.orders, orderId]);

  useEffect(() => {
    if (lifecycleRunning) {
      pollRef.current = setInterval(() => router.refresh(), 1000);
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [lifecycleRunning, router]);

  function act(fn: () => Promise<ActionResult>) {
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message, { description: r.detail ? JSON.stringify(r.detail).slice(0, 200) : undefined });
      else toast.error(r.message);
      router.refresh();
    });
  }

  const busy = pending || lifecycleRunning;
  const s = data.settings;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Demo control panel</h1>
          <p className="text-muted-foreground text-sm">Every control below drives the real order, payment and courier code paths through mock adapters.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {Object.entries(data.counts).map(([k, v]) => (
            <Badge key={k} variant="outline" className="rounded-lg">
              {k.replace(/_/g, " ")}: <span className="ml-1 font-semibold tabular-nums">{v}</span>
            </Badge>
          ))}
        </div>
      </header>

      {/* Environment readout */}
      <Card className="mb-6 rounded-2xl">
        <CardHeader>
          <CardTitle>Environment</CardTitle>
          <CardDescription>Which adapter each integration is using right now.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {data.adapters.map((a) => (
            <div key={a.integration} className="bg-paper rounded-xl border p-3">
              <div className="text-muted-foreground text-xs uppercase">{a.integration.replace(/_/g, " ")}</div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{a.adapter}</span>
                <StatusBadge value={a.mode} />
              </div>
              {a.note && <div className="text-muted-foreground mt-1 text-xs">{a.note}</div>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="courier">Courier</TabsTrigger>
          <TabsTrigger value="fraud">Fraud</TabsTrigger>
          <TabsTrigger value="sms">SMS log</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        {/* ORDERS */}
        <TabsContent value="orders">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Order controls</CardTitle>
              <CardDescription>Pick an order, then force a transition or run the whole lifecycle.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <OrderPicker orders={data.orders} value={orderId} onChange={setOrderId} />
              {order && (
                <div className="bg-paper grid gap-2 rounded-xl border p-3 text-sm sm:grid-cols-3">
                  <div>
                    Status: <StatusBadge value={order.status} />
                  </div>
                  <div>
                    Payment: {order.payment_method} / <StatusBadge value={order.payment_status} />
                  </div>
                  <div>
                    Courier: {order.shipment ? <StatusBadge value={order.shipment.normalized_status} /> : <span className="text-muted-foreground">not dispatched</span>}
                  </div>
                  <div>Total: <span className="price">{money(order.total_bdt)}</span></div>
                  <div>Fraud score: {order.fraud_score ?? "-"} {order.needs_review && <StatusBadge value="review" />}</div>
                  <div>Phone: {order.customer_phone}</div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {ORDER_STATUSES.map((st) => (
                  <Button key={st} size="sm" variant="outline" disabled={!orderId || busy} onClick={() => act(() => forceOrderStatus(orderId, st))}>
                    {st.replace(/_/g, " ")}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={!orderId || busy}
                  className="rounded-2xl"
                  onClick={() => {
                    setLifecycleRunning(true);
                    start(async () => {
                      const r = await runFullLifecycle(orderId);
                      setLifecycleRunning(false);
                      r.ok ? toast.success(r.message) : toast.error(r.message);
                      router.refresh();
                    });
                  }}
                >
                  {lifecycleRunning ? "Running lifecycle..." : "Run full lifecycle (~8 s)"}
                </Button>
                <Button variant="secondary" disabled={!orderId || busy} onClick={() => act(() => forceIntoReviewQueue(orderId))}>
                  Force into review queue
                </Button>
                <Button variant="secondary" disabled={!orderId || busy} onClick={() => act(() => triggerReturn(orderId))}>
                  Trigger a return
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PAYMENTS */}
        <TabsContent value="payments">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Payment controls</CardTitle>
              <CardDescription>
                Fires an SSLCommerz-shaped IPN at the real <code>/api/payment/ipn</code> handler. The tampered IPN carries a forged amount and must be rejected.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <OrderPicker orders={data.orders.filter((o) => o.payment_method === "sslcommerz")} value={orderId} onChange={setOrderId} emptyLabel="No online-payment orders yet" />
              <div className="flex flex-wrap gap-2">
                {(["success", "failed", "timeout", "tampered"] as IpnKind[]).map((k) => (
                  <Button key={k} variant={k === "tampered" ? "destructive" : k === "success" ? "default" : "outline"} disabled={!orderId || busy} onClick={() => act(() => firePaymentIpn(orderId, k))}>
                    {k === "tampered" ? "Fire TAMPERED IPN (wrong amount)" : `Fire ${k} IPN`}
                  </Button>
                ))}
              </div>
              <p className="text-muted-foreground text-sm">
                Or walk through the fake gateway page: open <code>/demo/gateway?txn=...</code> from a real checkout (Phase 7).
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* COURIER */}
        <TabsContent value="courier">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Courier controls</CardTitle>
              <CardDescription>Mock courier auto-advances shipments; each transition hits the real webhook logic.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Delivery speed</Label>
                <Select value={s.courier_speed} onValueChange={(v) => act(() => updateDemoSettings({ courier_speed: v as typeof s.courier_speed }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instant">Instant (one tick)</SelectItem>
                    <SelectItem value="fast">Fast (seconds)</SelectItem>
                    <SelectItem value="realistic">Realistic (minutes)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Balance</Label>
                <div className="price text-xl">{money(s.courier_balance)}</div>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => updateDemoSettings({ courier_balance: 25000 }))}>Reset to ৳25,000</Button>
              </div>
              <ToggleRow label="Force a return on the next dispatch" checked={s.force_return_next} disabled={busy} onChange={(v) => act(() => updateDemoSettings({ force_return_next: v }))} />
              <ToggleRow label="Simulate courier API outage" checked={s.courier_outage} disabled={busy} onChange={(v) => act(() => updateDemoSettings({ courier_outage: v }))} />
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button disabled={busy} onClick={() => act(() => courierTick(false))}>Run courier tick (due only)</Button>
                <Button variant="secondary" disabled={busy} onClick={() => act(() => courierTick(true))}>Advance all in-flight shipments to the end</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FRAUD */}
        <TabsContent value="fraud">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Fraud controls</CardTitle>
              <CardDescription>Deterministic courier-score profiles. Use these numbers at checkout to demo each path.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Profile</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Parcels</TableHead>
                      <TableHead>Success</TableHead>
                      <TableHead>Fraud reports</TableHead>
                      <TableHead>Expected outcome</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.knownPhones.map((k) => (
                      <TableRow key={k.phone}>
                        <TableCell className="font-medium">{k.label}</TableCell>
                        <TableCell className="font-mono">{k.phone}</TableCell>
                        <TableCell>{k.score.totalParcels}</TableCell>
                        <TableCell>{k.score.successRatio === null ? "-" : `${k.score.successRatio}%`}</TableCell>
                        <TableCell>{k.score.fraudReportCount}</TableCell>
                        <TableCell className="text-muted-foreground">{k.expect}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label htmlFor="override">Override score for the next order (blank = none)</Label>
                  <Input id="override" type="number" min={0} max={100} className="w-40" defaultValue={s.fraud_score_override ?? ""} onBlur={(e) => act(() => updateDemoSettings({ fraud_score_override: e.target.value === "" ? null : Number(e.target.value) }))} />
                </div>
                <span className="text-muted-foreground text-sm">Current: {s.fraud_score_override ?? "none"}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SMS */}
        <TabsContent value="sms">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>SMS log</CardTitle>
              <CardDescription>Mock adapter writes here instead of sending. OTP in demo mode is always 123456.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label htmlFor="failrate">Simulated failure rate</Label>
                  <Input id="failrate" type="number" min={0} max={1} step={0.05} className="w-32" defaultValue={s.sms_failure_rate} onBlur={(e) => act(() => updateDemoSettings({ sms_failure_rate: Math.min(1, Math.max(0, Number(e.target.value))) }))} />
                </div>
                <span className="text-muted-foreground text-sm">Current: {Math.round(s.sms_failure_rate * 100)}%</span>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Kind</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.smsLog.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-muted-foreground">No messages yet.</TableCell></TableRow>
                    )}
                    {data.smsLog.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="whitespace-nowrap">{new Date(m.sent_at).toLocaleString()}</TableCell>
                        <TableCell className="font-mono">{m.to_phone}</TableCell>
                        <TableCell>{m.kind}</TableCell>
                        <TableCell><StatusBadge value={m.status} /></TableCell>
                        <TableCell className="max-w-md truncate">{m.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DATA */}
        <TabsContent value="data">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Data controls</CardTitle>
              <CardDescription>Seed engine uses a fixed random seed: the same data every time.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="n">Generate orders</Label>
                  <Input id="n" type="number" min={1} max={200} className="w-28" value={n} onChange={(e) => setN(Number(e.target.value))} />
                </div>
                <Button disabled={busy} onClick={() => act(() => generateDemoOrders(n))}>Generate</Button>
              </div>
              <div className="flex items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="days">Jump the clock (days)</Label>
                  <Input id="days" type="number" min={-365} max={365} className="w-28" value={days} onChange={(e) => setDays(Number(e.target.value))} />
                </div>
                <Button disabled={busy} onClick={() => act(() => jumpClock(days))}>Shift</Button>
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button variant="secondary" disabled={busy} onClick={() => act(() => seedEverything())}>Seed (idempotent)</Button>
                <Button variant="outline" disabled={busy} onClick={() => confirm("Wipe orders, payments, shipments, reviews and re-seed them?") && act(() => resetTransactionalData())}>
                  Reset transactional
                </Button>
                <Button variant="destructive" disabled={busy} onClick={() => confirm("Wipe EVERYTHING including catalog and customers, then re-seed?") && act(() => resetAllData())}>
                  Reset all
                </Button>
              </div>
              <p className="text-muted-foreground text-sm sm:col-span-2">
                Same operations over HTTP (gated by DEMO_SEED_TOKEN): <code>POST /api/demo/reset</code>, <code>/api/demo/reset-all</code>, <code>/api/demo/generate-orders?n=20</code>.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OrderPicker({ orders, value, onChange, emptyLabel = "No orders yet - seed first" }: { orders: PanelOrder[]; value: string; onChange: (v: string) => void; emptyLabel?: string }) {
  if (orders.length === 0) return <p className="text-muted-foreground text-sm">{emptyLabel}</p>;
  return (
    <div className="space-y-1">
      <Label>Order</Label>
      <Select value={orders.some((o) => o.id === value) ? value : orders[0].id} onValueChange={onChange}>
        <SelectTrigger className="w-full sm:w-[520px]"><SelectValue placeholder="Pick an order" /></SelectTrigger>
        <SelectContent>
          {orders.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.order_number} · {o.status.replace(/_/g, " ")} · {o.payment_method} · {money(o.total_bdt)} · {o.customer_name ?? o.customer_phone}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ToggleRow({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="bg-paper flex items-center justify-between rounded-xl border p-3">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}
