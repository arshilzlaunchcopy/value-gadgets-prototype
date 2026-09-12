"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PageInput } from "@/lib/content/schema";
import { slugify } from "@/lib/format";
import { deletePageAction, savePageAction } from "../../actions";

const EMPTY: PageInput = { slug: "", title_en: "", title_bn: "", content_en: "", content_bn: "", is_published: true, show_in_footer: true, position: 10 };

export function PageEditor({ initial }: { initial: (PageInput & { id: string }) | null }) {
  const router = useRouter();
  const [p, setP] = useState<PageInput>(initial ?? EMPTY);
  const [pending, start] = useTransition();
  const set = <K extends keyof PageInput>(k: K, v: PageInput[K]) => setP({ ...p, [k]: v });

  const save = () =>
    start(async () => {
      const r = await savePageAction(p);
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.message ?? "Saved");
      if (!initial && r.data) router.replace(`/admin/content/pages/${r.data.id}`);
      else router.refresh();
    });

  return (
    <div className="space-y-4">
      <section className="bg-paper grid gap-3 rounded-2xl border p-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="title_en">Title (EN)</Label>
          <Input id="title_en" value={p.title_en} onChange={(e) => set("title_en", e.target.value)} onBlur={(e) => !p.slug && set("slug", slugify(e.target.value))} className="rounded-lg" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="title_bn">Title (BN)</Label>
          <Input id="title_bn" lang="bn" value={p.title_bn ?? ""} onChange={(e) => set("title_bn", e.target.value)} className="rounded-lg" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="slug">Slug (/pages/…)</Label>
          <Input id="slug" value={p.slug} onChange={(e) => set("slug", e.target.value)} className="rounded-lg font-mono" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="position">Footer position</Label>
          <Input id="position" type="number" value={p.position ?? 0} onChange={(e) => set("position", Number(e.target.value))} className="rounded-lg" />
        </div>
        <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">Published <Switch checked={p.is_published ?? true} onCheckedChange={(v) => set("is_published", v)} /></label>
        <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">Show in footer <Switch checked={p.show_in_footer ?? true} onCheckedChange={(v) => set("show_in_footer", v)} /></label>
      </section>
      <Tabs defaultValue="en">
        <TabsList className="rounded-lg">
          <TabsTrigger value="en">English</TabsTrigger>
          <TabsTrigger value="bn">বাংলা {p.content_bn ? "" : "(empty)"}</TabsTrigger>
        </TabsList>
        <TabsContent value="en" className="bg-paper rounded-2xl border p-4"><MarkdownEditor value={p.content_en ?? ""} onChange={(v) => set("content_en", v)} lang="en" /></TabsContent>
        <TabsContent value="bn" className="bg-paper rounded-2xl border p-4"><MarkdownEditor value={p.content_bn ?? ""} onChange={(v) => set("content_bn", v)} lang="bn" placeholder="বাংলা কনটেন্ট (DBID-এর জন্য শর্তাবলী বাংলায় থাকা বাধ্যতামূলক)" /></TabsContent>
      </Tabs>
      <div className="flex gap-2">
        <Button className="rounded-lg" disabled={pending || !p.title_en || !p.slug} onClick={save}>{initial ? "Save page" : "Create page"}</Button>
        {initial && <Button variant="outline" className="rounded-lg" asChild><a href={`/pages/${initial.slug}`} target="_blank">View</a></Button>}
        {initial && <Button variant="outline" className="text-danger rounded-lg" disabled={pending} onClick={() => confirm("Delete this page?") && start(async () => { const r = await deletePageAction(initial.id); if (r.ok) router.replace("/admin/content"); else toast.error(r.error); })}>Delete</Button>}
      </div>
    </div>
  );
}
