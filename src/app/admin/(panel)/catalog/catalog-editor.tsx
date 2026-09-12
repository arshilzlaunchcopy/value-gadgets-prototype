"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveCategoryAction, saveCollectionAction } from "../seo/actions";

interface Category {
  id: string;
  name_en: string;
  name_bn: string;
  slug: string;
  description_en: string;
  description_bn: string;
  parent_id: string | null;
  position: number;
  is_active: boolean;
  index_filters: boolean;
  products: number;
}
interface Collection {
  id: string;
  title_en: string;
  title_bn: string;
  slug: string;
  description_en: string;
  position: number;
  is_active: boolean;
  is_automatic: boolean;
  products: number;
}

type R = { ok: boolean; error?: string; message?: string };

export function CatalogEditor({ categories, collections }: { categories: Category[]; collections: Collection[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [cats, setCats] = useState(categories);
  const [cols, setCols] = useState(collections);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<R>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? "Saved");
        setOpen(null);
        router.refresh();
      } else toast.error(r.error ?? "Failed");
    });
  const parentName = (id: string | null) => cats.find((c) => c.id === id)?.name_en;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="bg-paper rounded-2xl border">
        <h2 className="border-b px-4 py-3 font-semibold">Categories ({cats.length})</h2>
        <ul className="divide-y text-sm">
          {cats.map((c, i) => (
            <li key={c.id} className="p-3">
              <div className="flex items-center gap-2">
                <span className={`min-w-0 flex-1 ${c.parent_id ? "pl-4" : ""}`}>
                  <span className="font-medium">{c.name_en}</span>
                  <span className="text-muted-foreground block text-xs">/category/{c.slug} · {c.products} products{c.parent_id ? ` · in ${parentName(c.parent_id)}` : ""}{c.index_filters ? " · filters indexed" : ""}{c.is_active ? "" : " · hidden"}</span>
                </span>
                <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? "Close" : "Edit"}</Button>
              </div>
              {open === c.id && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Field label="Name (EN)"><Input value={c.name_en} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, name_en: e.target.value } : x)))} className="rounded-lg" /></Field>
                  <Field label="Name (BN)"><Input lang="bn" value={c.name_bn} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, name_bn: e.target.value } : x)))} className="rounded-lg" /></Field>
                  <Field label="Slug"><Input value={c.slug} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, slug: e.target.value } : x)))} className="rounded-lg font-mono text-xs" /></Field>
                  <Field label="Position"><Input type="number" value={c.position} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, position: Number(e.target.value) } : x)))} className="rounded-lg" /></Field>
                  <Field label="Description (EN)" wide><Textarea rows={2} value={c.description_en} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, description_en: e.target.value } : x)))} className="rounded-lg" /></Field>
                  <Field label="Description (BN)" wide><Textarea lang="bn" rows={2} value={c.description_bn} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, description_bn: e.target.value } : x)))} className="rounded-lg" /></Field>
                  <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">Active <Switch checked={c.is_active} onCheckedChange={(v) => setCats(cats.map((x, j) => (j === i ? { ...x, is_active: v } : x)))} /></label>
                  <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">Index filtered URLs <Switch checked={c.index_filters} onCheckedChange={(v) => setCats(cats.map((x, j) => (j === i ? { ...x, index_filters: v } : x)))} /></label>
                  <Button className="rounded-lg sm:col-span-2" disabled={pending} onClick={() => run(() => saveCategoryAction({ id: c.id, name_en: c.name_en, name_bn: c.name_bn, slug: c.slug, description_en: c.description_en, description_bn: c.description_bn, position: c.position, is_active: c.is_active, index_filters: c.index_filters }))}>Save category</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="bg-paper rounded-2xl border">
        <h2 className="border-b px-4 py-3 font-semibold">Collections ({cols.length})</h2>
        <ul className="divide-y text-sm">
          {cols.map((c, i) => (
            <li key={c.id} className="p-3">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{c.title_en}</span>
                  <span className="text-muted-foreground block text-xs">/collection/{c.slug} · {c.products} products{c.is_automatic ? " · automatic" : ""}{c.is_active ? "" : " · hidden"}</span>
                </span>
                <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? "Close" : "Edit"}</Button>
              </div>
              {open === c.id && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Field label="Title (EN)"><Input value={c.title_en} onChange={(e) => setCols(cols.map((x, j) => (j === i ? { ...x, title_en: e.target.value } : x)))} className="rounded-lg" /></Field>
                  <Field label="Title (BN)"><Input lang="bn" value={c.title_bn} onChange={(e) => setCols(cols.map((x, j) => (j === i ? { ...x, title_bn: e.target.value } : x)))} className="rounded-lg" /></Field>
                  <Field label="Slug"><Input value={c.slug} onChange={(e) => setCols(cols.map((x, j) => (j === i ? { ...x, slug: e.target.value } : x)))} className="rounded-lg font-mono text-xs" /></Field>
                  <Field label="Position"><Input type="number" value={c.position} onChange={(e) => setCols(cols.map((x, j) => (j === i ? { ...x, position: Number(e.target.value) } : x)))} className="rounded-lg" /></Field>
                  <Field label="Description" wide><Textarea rows={2} value={c.description_en} onChange={(e) => setCols(cols.map((x, j) => (j === i ? { ...x, description_en: e.target.value } : x)))} className="rounded-lg" /></Field>
                  <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs sm:col-span-2">Active <Switch checked={c.is_active} onCheckedChange={(v) => setCols(cols.map((x, j) => (j === i ? { ...x, is_active: v } : x)))} /></label>
                  <Button className="rounded-lg sm:col-span-2" disabled={pending} onClick={() => run(() => saveCollectionAction({ id: c.id, title_en: c.title_en, title_bn: c.title_bn, slug: c.slug, description_en: c.description_en, position: c.position, is_active: c.is_active }))}>Save collection</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`space-y-1 ${wide ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
