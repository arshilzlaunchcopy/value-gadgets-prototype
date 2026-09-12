"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { deleteRedirectAction, importRedirectsCsvAction, saveRedirectAction } from "../actions";

interface Row {
  id: string;
  from_path: string;
  to_path: string;
  status_code: 301 | 302 | 410;
  hit_count: number;
  last_hit_at: string | null;
  is_active: boolean;
  created_at: string;
}

type R = { ok: boolean; error?: string; message?: string };

export function RedirectsManager({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState({ from_path: "", to_path: "", status_code: 301 as 301 | 302 | 410 });
  const [csv, setCsv] = useState("");
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<R>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? "Saved");
        after?.();
        router.refresh();
      } else toast.error(r.error ?? "Failed");
    });
  const shown = rows.filter((r) => !q || `${r.from_path} ${r.to_path}`.includes(q));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <section className="bg-paper overflow-x-auto rounded-2xl border">
        <div className="flex items-center gap-2 border-b p-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by path" className="max-w-xs rounded-lg" aria-label="Filter" />
          <span className="text-muted-foreground ml-auto text-xs">{shown.length} rule(s)</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-paper-soft text-left text-xs uppercase"><tr><th className="px-3 py-2">From</th><th className="px-3 py-2">To</th><th className="px-3 py-2">Code</th><th className="px-3 py-2 text-right">Hits</th><th className="px-3 py-2">Last hit</th><th className="px-3 py-2" /></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className={`border-t ${r.is_active ? "" : "opacity-50"}`}>
                <td className="px-3 py-2 font-mono text-xs">{r.from_path}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.to_path}</td>
                <td className="px-3 py-2 text-xs">{r.status_code}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.hit_count}</td>
                <td className="px-3 py-2 text-xs">{r.last_hit_at ? formatDateTime(r.last_hit_at) : "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <Button size="sm" variant="ghost" className="rounded-lg text-xs" disabled={pending} onClick={() => run(() => saveRedirectAction({ ...r, is_active: !r.is_active }))}>{r.is_active ? "Disable" : "Enable"}</Button>
                  <Button size="sm" variant="ghost" className="text-danger rounded-lg text-xs" disabled={pending} onClick={() => confirm("Delete this redirect?") && run(() => deleteRedirectAction(r.id))}>Delete</Button>
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={6} className="text-muted-foreground px-3 py-8 text-center">No redirects.</td></tr>}
          </tbody>
        </table>
      </section>
      <aside className="space-y-4">
        <section className="bg-paper space-y-2 rounded-2xl border p-4 text-sm">
          <h2 className="font-semibold">Add a redirect</h2>
          <Input value={draft.from_path} onChange={(e) => setDraft({ ...draft, from_path: e.target.value })} placeholder="/old-path" className="rounded-lg font-mono text-xs" aria-label="From path" />
          <Input value={draft.to_path} onChange={(e) => setDraft({ ...draft, to_path: e.target.value })} placeholder="/new-path or https://…" className="rounded-lg font-mono text-xs" aria-label="To path" />
          <select value={draft.status_code} onChange={(e) => setDraft({ ...draft, status_code: Number(e.target.value) as 301 | 302 | 410 })} className="bg-paper w-full rounded-lg border px-3 py-2 text-sm" aria-label="Status code">
            <option value={301}>301 permanent</option>
            <option value={302}>302 temporary</option>
            <option value={410}>410 gone</option>
          </select>
          <Button className="w-full rounded-lg" disabled={pending || !draft.from_path || !draft.to_path} onClick={() => run(() => saveRedirectAction({ ...draft, is_active: true }), () => setDraft({ from_path: "", to_path: "", status_code: 301 }))}>Save</Button>
        </section>
        <section className="bg-paper space-y-2 rounded-2xl border p-4 text-sm">
          <h2 className="font-semibold">CSV import</h2>
          <p className="text-muted-foreground text-xs">One per line: <code>from_path,to_path,301</code>. The status code is optional.</p>
          <Textarea rows={6} value={csv} onChange={(e) => setCsv(e.target.value)} className="rounded-lg font-mono text-xs" placeholder="/old-hub,/products/ugreen-8-in-1-usb-c-hub,301" />
          <Button variant="outline" className="w-full rounded-lg" disabled={pending || !csv.trim()} onClick={() => run(() => importRedirectsCsvAction(csv), () => setCsv(""))}>Import</Button>
        </section>
      </aside>
    </div>
  );
}
