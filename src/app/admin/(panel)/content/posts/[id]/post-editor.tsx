"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { MediaPicker } from "@/components/admin/media-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { PostInput } from "@/lib/content/schema";
import { slugify } from "@/lib/format";
import { deletePostAction, savePostAction } from "../../actions";

const EMPTY: PostInput = { slug: "", title_en: "", excerpt_en: "", content_en: "", title_bn: "", excerpt_bn: "", content_bn: "", cover_image_url: "", cover_alt: "", author_name: "Store team", reading_minutes: 3, status: "draft", related_product_ids: [] };

export function PostEditor({ initial, products }: { initial: (PostInput & { id: string }) | null; products: { id: string; label: string }[] }) {
  const router = useRouter();
  const [p, setP] = useState<PostInput>(initial ?? EMPTY);
  const [pending, start] = useTransition();
  const set = <K extends keyof PostInput>(k: K, v: PostInput[K]) => setP({ ...p, [k]: v });
  const words = (p.content_en ?? "").split(/\s+/).filter(Boolean).length;

  const save = () =>
    start(async () => {
      const r = await savePostAction({ ...p, reading_minutes: p.reading_minutes || Math.max(1, Math.round(words / 200)) });
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.message ?? "Saved");
      if (!initial && r.data) router.replace(`/admin/content/posts/${r.data.id}`);
      else router.refresh();
    });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <section className="bg-paper grid gap-3 rounded-2xl border p-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="title_en">Title (EN)</Label>
            <Input id="title_en" value={p.title_en} onChange={(e) => set("title_en", e.target.value)} onBlur={(e) => !p.slug && set("slug", slugify(e.target.value))} className="rounded-lg" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="slug">Slug (/blog/…)</Label>
            <Input id="slug" value={p.slug} onChange={(e) => set("slug", e.target.value)} className="rounded-lg font-mono" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="author">Author</Label>
            <Input id="author" value={p.author_name ?? ""} onChange={(e) => set("author_name", e.target.value)} className="rounded-lg" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="excerpt_en">Excerpt (EN) - also the meta description fallback</Label>
            <Textarea id="excerpt_en" rows={2} value={p.excerpt_en ?? ""} onChange={(e) => set("excerpt_en", e.target.value)} className="rounded-lg" />
          </div>
        </section>
        <Tabs defaultValue="en">
          <TabsList className="rounded-lg">
            <TabsTrigger value="en">English · {words} words</TabsTrigger>
            <TabsTrigger value="bn">বাংলা {p.content_bn ? "" : "(empty)"}</TabsTrigger>
          </TabsList>
          <TabsContent value="en" className="bg-paper rounded-2xl border p-4"><MarkdownEditor value={p.content_en ?? ""} onChange={(v) => set("content_en", v)} lang="en" /></TabsContent>
          <TabsContent value="bn" className="bg-paper space-y-3 rounded-2xl border p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input lang="bn" value={p.title_bn ?? ""} onChange={(e) => set("title_bn", e.target.value)} placeholder="শিরোনাম" className="rounded-lg" aria-label="Title (BN)" />
              <Input lang="bn" value={p.excerpt_bn ?? ""} onChange={(e) => set("excerpt_bn", e.target.value)} placeholder="সারসংক্ষেপ" className="rounded-lg" aria-label="Excerpt (BN)" />
            </div>
            <MarkdownEditor value={p.content_bn ?? ""} onChange={(v) => set("content_bn", v)} lang="bn" />
          </TabsContent>
        </Tabs>
      </div>
      <aside className="bg-paper space-y-3 rounded-2xl border p-4 text-sm">
        <div className="space-y-1">
          <Label htmlFor="status">Status</Label>
          <select id="status" value={p.status} onChange={(e) => set("status", e.target.value as "draft" | "published")} className="bg-paper h-10 w-full rounded-lg border px-3 text-sm">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label>Cover image</Label>
          <MediaPicker value={p.cover_image_url ?? ""} onChange={(url) => set("cover_image_url", url)} />
          <Input value={p.cover_alt ?? ""} onChange={(e) => set("cover_alt", e.target.value)} placeholder="Cover alt text" className="rounded-lg" aria-label="Cover alt text" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rm">Reading minutes (0 = auto)</Label>
          <Input id="rm" type="number" value={p.reading_minutes ?? 3} onChange={(e) => set("reading_minutes", Number(e.target.value))} className="rounded-lg" />
        </div>
        <div className="space-y-1">
          <Label>Related products (ctrl-click for several)</Label>
          <select multiple value={p.related_product_ids ?? []} onChange={(e) => set("related_product_ids", [...e.target.selectedOptions].map((o) => o.value).slice(0, 8))} className="bg-paper h-40 w-full rounded-lg border px-2 text-xs">
            {products.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </div>
        <Button className="w-full rounded-lg" disabled={pending || !p.title_en || !p.slug} onClick={save}>{initial ? "Save post" : "Create post"}</Button>
        {initial && <Button variant="outline" className="w-full rounded-lg" asChild><a href={`/blog/${initial.slug}`} target="_blank">View</a></Button>}
        {initial && <Button variant="outline" className="text-danger w-full rounded-lg" disabled={pending} onClick={() => confirm("Delete this post?") && start(async () => { const r = await deletePostAction(initial.id); if (r.ok) router.replace("/admin/content"); else toast.error(r.error); })}>Delete</Button>}
      </aside>
    </div>
  );
}
