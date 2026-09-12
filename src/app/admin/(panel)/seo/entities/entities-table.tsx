"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { MediaPicker } from "@/components/admin/media-picker";
import { SerpPreview } from "@/components/admin/serp-preview";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { publicEnv } from "@/lib/env.public";
import type { SeoEntityRow } from "@/lib/seo/audit";
import { bulkSeoAction, saveSeoMetaAction } from "../actions";

type R = { ok: boolean; error?: string; message?: string };

export function EntitiesTable({ rows, kind }: { rows: SeoEntityRow[]; kind: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [onlyGenerated, setOnlyGenerated] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<SeoEntityRow | null>(null);
  const [form, setForm] = useState({ meta_title: "", meta_description: "", og_image_url: "", robots: "index,follow" });
  const [bulk, setBulk] = useState({ title_template: "{title} — {brand} | {store}", description_template: "Buy {title} at {price} from {store}. Official warranty, cash on delivery across Bangladesh.", only_missing: true });
  const [pending, start] = useTransition();

  const filtered = useMemo(() => rows.filter((r) => (!q || `${r.label} ${r.path}`.toLowerCase().includes(q.toLowerCase())) && (!onlyGenerated || r.titleSource === "generated")), [rows, q, onlyGenerated]);
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);
  const run = (fn: () => Promise<R>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? "Saved");
        after?.();
        router.refresh();
      } else toast.error(r.error ?? "Failed");
    });

  const open = (r: SeoEntityRow) => {
    setEditing(r);
    setForm({ meta_title: r.titleSource === "explicit" ? r.title : "", meta_description: r.descriptionSource === "explicit" ? r.description : "", og_image_url: "", robots: r.robots });
  };

  return (
    <div className="space-y-3">
      <div className="bg-paper flex flex-wrap items-center gap-2 rounded-2xl border p-3 text-sm">
        <select value={kind} onChange={(e) => router.push(`/admin/seo/entities${e.target.value ? `?kind=${e.target.value}` : ""}`)} className="bg-paper rounded-lg border px-3 py-2 text-sm" aria-label="Type">
          <option value="">All types</option>
          {["product", "category", "collection", "page", "post"].map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or path" className="max-w-xs rounded-lg" aria-label="Search" />
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={onlyGenerated} onChange={(e) => setOnlyGenerated(e.target.checked)} className="accent-amber" /> Only generated titles</label>
        <span className="text-muted-foreground ml-auto text-xs">{filtered.length} of {rows.length}</span>
      </div>

      {selectedIds.length > 0 && (
        <div className="bg-amber/15 space-y-2 rounded-2xl border p-3 text-sm">
          <p className="font-medium">Bulk edit {selectedIds.length} product(s) · placeholders: {"{title} {brand} {price} {category} {store} {short_description}"}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input value={bulk.title_template} onChange={(e) => setBulk({ ...bulk, title_template: e.target.value })} placeholder="Title template" className="rounded-lg" aria-label="Title template" />
            <Input value={bulk.description_template} onChange={(e) => setBulk({ ...bulk, description_template: e.target.value })} placeholder="Description template" className="rounded-lg" aria-label="Description template" />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={bulk.only_missing} onChange={(e) => setBulk({ ...bulk, only_missing: e.target.checked })} className="accent-amber" /> Only fill missing fields</label>
            <Button size="sm" className="rounded-lg" disabled={pending} onClick={() => run(() => bulkSeoAction({ ids: selectedIds, ...bulk }), () => setSelected({}))}>Apply</Button>
          </div>
        </div>
      )}

      <div className="bg-paper overflow-x-auto rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-paper-soft text-left text-xs uppercase">
            <tr>
              <th className="px-3 py-2"><input type="checkbox" aria-label="Select all products" className="accent-amber" onChange={(e) => setSelected(Object.fromEntries(filtered.filter((r) => r.kind === "product").map((r) => [r.id, e.target.checked])))} /></th>
              <th className="px-3 py-2">Page</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2 text-right">Score</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={`${r.kind}:${r.id}`} className="border-t align-top">
                <td className="px-3 py-2">{r.kind === "product" && <input type="checkbox" checked={Boolean(selected[r.id])} onChange={(e) => setSelected({ ...selected, [r.id]: e.target.checked })} className="accent-amber" aria-label={`Select ${r.label}`} />}</td>
                <td className="px-3 py-2">
                  <span className="block max-w-56 truncate font-medium">{r.label}</span>
                  <a href={r.path} target="_blank" className="text-muted-foreground block max-w-56 truncate text-xs underline">{r.path}</a>
                </td>
                <td className="px-3 py-2">
                  <span className="block max-w-72 truncate">{r.title}</span>
                  <span className={`text-[10px] uppercase ${r.titleSource === "explicit" ? "text-success-deep" : "text-muted-foreground"}`}>{r.titleSource}</span>
                </td>
                <td className="px-3 py-2">
                  <span className="text-muted-foreground line-clamp-2 max-w-80 text-xs">{r.description || "—"}</span>
                  <span className={`text-[10px] uppercase ${r.descriptionSource === "explicit" ? "text-success-deep" : r.descriptionSource === "missing" ? "text-danger" : "text-muted-foreground"}`}>{r.descriptionSource}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className={`font-semibold tabular-nums ${r.score >= 80 ? "text-success-deep" : r.score >= 60 ? "text-warn-deep" : "text-danger"}`}>{r.score}</span>
                  {r.issues.length > 0 && <span className="text-muted-foreground block max-w-40 text-[11px]">{r.issues.join(" · ")}</span>}
                </td>
                <td className="px-3 py-2"><Button size="sm" variant="outline" className="rounded-lg" onClick={() => open(r)}>Edit</Button></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="text-muted-foreground px-3 py-8 text-center">Nothing matches.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Meta for {editing?.label}</DialogTitle>
            <DialogDescription>Leave a field blank to keep the generated value. Pixel widths, not character counts.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="mt">Meta title</Label>
                  <Input id="mt" value={form.meta_title} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} placeholder={editing.title} className="rounded-lg" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="md">Meta description</Label>
                  <Textarea id="md" rows={3} value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} placeholder={editing.description} className="rounded-lg" />
                </div>
                <div className="space-y-1">
                  <Label>Share image</Label>
                  <MediaPicker value={form.og_image_url} onChange={(url) => setForm({ ...form, og_image_url: url })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="robots">Robots</Label>
                  <select id="robots" value={form.robots} onChange={(e) => setForm({ ...form, robots: e.target.value })} className="bg-paper w-full rounded-lg border px-3 py-2 text-sm">
                    <option value="index,follow">index, follow</option>
                    <option value="noindex,follow">noindex, follow</option>
                    <option value="noindex,nofollow">noindex, nofollow</option>
                  </select>
                </div>
                <Button className="rounded-lg" disabled={pending} onClick={() => run(() => saveSeoMetaAction({ entity_type: editing.kind, entity_id: editing.id, locale: "en", ...form }), () => setEditing(null))}>Save</Button>
              </div>
              <SerpPreview title={form.meta_title || editing.title} description={form.meta_description || editing.description} url={`${publicEnv.siteUrl}${editing.path}`} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
