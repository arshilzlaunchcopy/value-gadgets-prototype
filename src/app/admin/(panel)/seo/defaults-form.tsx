"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MediaPicker } from "@/components/admin/media-picker";
import { SerpPreview } from "@/components/admin/serp-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { SeoSettings } from "@/lib/seo/settings";
import { regenerateFeedsAction, saveSeoSettingsAction } from "./actions";

const TEMPLATES: { key: keyof SeoSettings; label: string; hint: string }[] = [
  { key: "title_template_product", label: "Product title template", hint: "{title} {store}" },
  { key: "title_template_category", label: "Category title template", hint: "{name} {store}" },
  { key: "title_template_collection", label: "Collection title template", hint: "{name} {store}" },
  { key: "title_template_post", label: "Blog post title template", hint: "{title} {store}" },
  { key: "title_template_page", label: "Static page title template", hint: "{title} {store}" },
];

export function SeoDefaultsForm({ initial }: { initial: SeoSettings }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const set = <K extends keyof SeoSettings>(k: K, val: SeoSettings[K]) => setV({ ...v, [k]: val });
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message ?? "Saved");
      else toast.error(r.error ?? "Failed");
      router.refresh();
    });

  return (
    <section className="bg-paper space-y-4 rounded-2xl border p-4">
      <div>
        <h2 className="font-semibold">Site-wide defaults and title templates</h2>
        <p className="text-muted-foreground text-xs">Fallback chain: explicit meta on the entity → these templates → the site default description.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {TEMPLATES.map((t) => (
          <div key={t.key} className="space-y-1">
            <Label htmlFor={t.key} className="text-xs">{t.label} <span className="text-muted-foreground">({t.hint})</span></Label>
            <Input id={t.key} value={String(v[t.key])} onChange={(e) => set(t.key, e.target.value as never)} className="rounded-lg" />
          </div>
        ))}
        <div className="space-y-1">
          <Label htmlFor="home_title" className="text-xs">Home page title (blank = store name + tagline)</Label>
          <Input id="home_title" value={v.home_title} onChange={(e) => set("home_title", e.target.value)} className="rounded-lg" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="default_description" className="text-xs">Default description</Label>
          <Textarea id="default_description" rows={2} value={v.default_description} onChange={(e) => set("default_description", e.target.value)} className="rounded-lg" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Default share image (OG)</Label>
          <MediaPicker value={v.default_og_image} onChange={(url) => set("default_og_image", url)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="gsc" className="text-xs">Google Search Console verification (content value)</Label>
          <Input id="gsc" value={v.gsc_verification} onChange={(e) => set("gsc_verification", e.target.value)} className="rounded-lg font-mono text-xs" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ga4" className="text-xs">GA4 measurement id</Label>
          <Input id="ga4" placeholder="G-XXXXXXXXXX" value={v.ga4_id} onChange={(e) => set("ga4_id", e.target.value)} className="rounded-lg font-mono text-xs" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pixel" className="text-xs">Meta Pixel id</Label>
          <Input id="pixel" value={v.meta_pixel_id} onChange={(e) => set("meta_pixel_id", e.target.value)} className="rounded-lg font-mono text-xs" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="capi" className="text-xs">Meta Conversions API token (server-side purchase events; stays server-side)</Label>
          <Input id="capi" type="password" value={v.meta_capi_token} onChange={(e) => set("meta_capi_token", e.target.value)} className="rounded-lg font-mono text-xs" />
        </div>
        <div className="flex items-center justify-between rounded-lg border px-3 py-2 sm:col-span-2">
          <Label htmlFor="index" className="text-xs">Allow search engines to index the site (turn off on staging)</Label>
          <Switch id="index" checked={v.index_site} onCheckedChange={(c) => set("index_site", c)} />
        </div>
      </div>
      <SerpPreview title={v.title_template_product.replace("{title}", "UGREEN 8-in-1 USB-C Hub").replace("{store}", "Store")} description={v.default_description} url="https://example.com/products/ugreen-8-in-1-usb-c-hub" />
      <div className="flex gap-2">
        <Button className="rounded-lg" disabled={pending} onClick={() => run(() => saveSeoSettingsAction(v))}>Save defaults</Button>
        <Button variant="outline" className="rounded-lg" disabled={pending} onClick={() => run(regenerateFeedsAction)}>Regenerate feeds & sitemap</Button>
      </div>
    </section>
  );
}
