"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import type { FraudRule, FraudThresholds } from "@/lib/fraud/score";
import { addBlockAction, removeBlockAction, saveRulesAction, saveStatusMapAction, saveThresholdsAction } from "./actions";

interface Blocked {
  id: string;
  type: string;
  value: string;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
}

type R = { ok: boolean; error?: string; message?: string };

export function FraudConsole({ rules: initialRules, thresholds: initialT, serviceDistricts, blocked, statusMapDefaults, statusMapCustom }: { rules: FraudRule[]; thresholds: FraudThresholds; serviceDistricts: string[]; blocked: Blocked[]; statusMapDefaults: Record<string, string>; statusMapCustom: Record<string, string> }) {
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [t, setT] = useState(initialT);
  const [districts, setDistricts] = useState(serviceDistricts.join("\n"));
  const [statusMap, setStatusMap] = useState(Object.entries(statusMapCustom).map(([k, v]) => `${k} = ${v}`).join("\n"));
  const [block, setBlock] = useState({ type: "phone", value: "", reason: "", expires_days: "" });
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<R>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message ?? "Saved");
      else toast.error(r.error ?? "Failed");
      router.refresh();
    });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="bg-paper rounded-2xl border p-4">
        <h2 className="font-semibold">Thresholds (PART2 §14.3)</h2>
        <p className="text-muted-foreground mb-3 text-xs">Score below review and (paid online or COD under the ceiling) auto-confirms and auto-dispatches. Trusted courier history multiplies the ceiling.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["review", "Review queue at score ≥"],
              ["advance", "Advance payment at score ≥"],
              ["reverify_otp", "Re-verify phone at score ≥"],
              ["cod_auto_confirm_max", "COD auto-confirm ceiling (৳)"],
              ["trusted_cod_multiplier", "Trusted ceiling multiplier"],
            ] as const
          ).map(([k, label]) => (
            <div key={k} className="space-y-1">
              <Label htmlFor={`t-${k}`} className="text-xs">{label}</Label>
              <Input id={`t-${k}`} type="number" step={k === "trusted_cod_multiplier" ? 0.5 : 1} value={t[k]} onChange={(e) => setT({ ...t, [k]: Number(e.target.value) })} className="rounded-lg" />
            </div>
          ))}
          <div className="flex items-center justify-between rounded-lg border px-3 py-2 sm:col-span-2">
            <Label htmlFor="t-auto" className="text-xs">Auto-dispatch to courier after auto-confirm</Label>
            <Switch id="t-auto" checked={t.auto_dispatch} onCheckedChange={(v) => setT({ ...t, auto_dispatch: v })} />
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <Label htmlFor="districts" className="text-xs">Serviced districts (one per line; blank = all districts serviced)</Label>
          <Textarea id="districts" rows={3} value={districts} onChange={(e) => setDistricts(e.target.value)} className="rounded-lg text-xs" placeholder="Dhaka&#10;Gazipur&#10;Chattogram" />
        </div>
        <Button className="mt-3 rounded-lg" disabled={pending} onClick={() => run(() => saveThresholdsAction(t, districts))}>Save thresholds</Button>
      </section>

      <section className="bg-paper rounded-2xl border p-4">
        <h2 className="font-semibold">Scoring rules (BUILD_PROMPT §4.6, §14.5)</h2>
        <p className="text-muted-foreground mb-3 text-xs">Points are added when a rule fires. Negative points reward trusted history.</p>
        <ul className="divide-y text-sm">
          {rules.map((r, i) => (
            <li key={r.key} className="flex items-center gap-3 py-2">
              <Switch checked={r.is_active} onCheckedChange={(v) => setRules(rules.map((x, j) => (j === i ? { ...x, is_active: v } : x)))} aria-label={`${r.name} active`} />
              <span className={`flex-1 ${r.is_active ? "" : "text-muted-foreground line-through"}`}>{r.name}</span>
              <Input type="number" value={r.score_delta} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, score_delta: Number(e.target.value) } : x)))} className="w-20 rounded-lg text-right" aria-label={`${r.name} points`} />
            </li>
          ))}
        </ul>
        <Button className="mt-3 rounded-lg" disabled={pending} onClick={() => run(() => saveRulesAction(rules.map((r) => ({ key: r.key, score_delta: r.score_delta, is_active: r.is_active, rule: r.rule }))))}>Save rules</Button>
      </section>

      <section className="bg-paper rounded-2xl border p-4">
        <h2 className="font-semibold">Blocked entities</h2>
        <p className="text-muted-foreground mb-3 text-xs">Checkout refuses a blocked phone, IP or email outright. Blocking a phone also blocks the customer account.</p>
        <div className="grid gap-2 sm:grid-cols-[110px_1fr]">
          <select value={block.type} onChange={(e) => setBlock({ ...block, type: e.target.value })} className="bg-paper rounded-lg border px-3 py-2 text-sm" aria-label="Type">
            <option value="phone">Phone</option>
            <option value="ip">IP</option>
            <option value="email">Email</option>
            <option value="device">Device</option>
          </select>
          <Input value={block.value} onChange={(e) => setBlock({ ...block, value: e.target.value })} placeholder={block.type === "phone" ? "01XXXXXXXXX" : block.type === "ip" ? "103.4.5.6" : "value"} className="rounded-lg" aria-label="Value" />
          <Input value={block.reason} onChange={(e) => setBlock({ ...block, reason: e.target.value })} placeholder="Reason" className="rounded-lg sm:col-span-2" aria-label="Reason" />
          <Input type="number" min={0} value={block.expires_days} onChange={(e) => setBlock({ ...block, expires_days: e.target.value })} placeholder="Expires in days (blank = permanent)" className="rounded-lg sm:col-span-2" aria-label="Expires in days" />
        </div>
        <Button className="mt-2 rounded-lg" disabled={pending || block.value.trim().length < 3} onClick={() => run(async () => { const r = await addBlockAction({ ...block, expires_days: block.expires_days ? Number(block.expires_days) : null }); if (r.ok) setBlock({ type: "phone", value: "", reason: "", expires_days: "" }); return r; })}>
          Block
        </Button>
        <ul className="mt-4 divide-y text-sm">
          {blocked.length === 0 && <li className="text-muted-foreground py-2 text-xs">Nothing blocked.</li>}
          {blocked.map((b) => (
            <li key={b.id} className="flex items-center gap-3 py-2">
              <span className="bg-muted rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase">{b.type}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-xs">{b.value}</span>
                <span className="text-muted-foreground block text-[11px]">{b.reason ?? "—"} · {formatDateTime(b.created_at)}{b.expires_at ? ` · until ${formatDateTime(b.expires_at)}` : ""}</span>
              </span>
              <Button size="sm" variant="outline" className="rounded-lg" disabled={pending} onClick={() => run(() => removeBlockAction(b.id))}>Unblock</Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-paper rounded-2xl border p-4">
        <h2 className="font-semibold">Courier status mapping (PART2 §14.4)</h2>
        <p className="text-muted-foreground mb-2 text-xs">Raw courier status → normalized status, one per line (<code>raw = normalized</code>). Overrides the built-in map without a deploy.</p>
        <Textarea rows={5} value={statusMap} onChange={(e) => setStatusMap(e.target.value)} className="rounded-lg font-mono text-xs" placeholder="delivered_to_hub = in_transit" />
        <Button className="mt-2 rounded-lg" disabled={pending} onClick={() => run(() => saveStatusMapAction(statusMap))}>Save mapping</Button>
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer">Built-in map ({Object.keys(statusMapDefaults).length})</summary>
          <ul className="mt-1 grid grid-cols-2 gap-x-3 font-mono">
            {Object.entries(statusMapDefaults).map(([k, v]) => (
              <li key={k}>{k} → {v}</li>
            ))}
          </ul>
        </details>
      </section>
    </div>
  );
}
