"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { MediaPicker } from "@/components/admin/media-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/format";
import { landingPageSchema, type LandingPageInput, type LandingPagePayload } from "@/lib/landing/schema";
import { copyVariantAction, deleteLandingPageAction, saveLandingPageAction } from "../actions";

export interface LandingEditorData {
  page: (LandingPagePayload & { id: string; variant_b_id: string; views_a: number; views_b: number }) | null;
  products: { id: string; label: string }[];
  blocksA: number;
  blocksB: number;
}

export function LandingEditor({ data }: { data: LandingEditorData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<LandingPageInput, unknown, LandingPagePayload>({
    resolver: zodResolver(landingPageSchema),
    defaultValues: data.page ?? { slug: "", title: "", product_id: "", status: "draft", chrome: "minimal", otp_mode: "above_threshold", otp_threshold_bdt: 3000, pixel_event: "Lead", ab_enabled: false, meta_title: "", meta_description: "", og_image_url: "" },
  });
  const { register, handleSubmit, control, setValue, watch, formState } = form;
  const abEnabled = watch("ab_enabled");
  const otpMode = watch("otp_mode");

  const save = handleSubmit((values) =>
    start(async () => {
      const r = await saveLandingPageAction(values);
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.message ?? "Saved");
      if (!data.page && r.data) router.replace(`/admin/landing/${r.data.id}`);
      else router.refresh();
    }),
  );

  return (
    <form onSubmit={save} className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <section className="bg-paper grid gap-3 rounded-2xl border p-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register("title", { onBlur: (e) => { if (!watch("slug")) setValue("slug", slugify(e.target.value)); } })} className="rounded-lg" />
            {formState.errors.title && <p className="text-danger text-xs">{formState.errors.title.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="slug">Slug (/lp/…)</Label>
            <Input id="slug" {...register("slug")} className="rounded-lg font-mono" />
            {formState.errors.slug && <p className="text-danger text-xs">{formState.errors.slug.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="product">Product for the quick order form</Label>
            <select id="product" {...register("product_id")} className="bg-paper h-10 w-full rounded-lg border px-3 text-sm">
              <option value="">None (set per block)</option>
              {data.products.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="chrome">Chrome</Label>
            <select id="chrome" {...register("chrome")} className="bg-paper h-10 w-full rounded-lg border px-3 text-sm">
              <option value="minimal">Minimal (logo + phone bar)</option>
              <option value="none">None</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pixel">Meta Pixel event override</Label>
            <Input id="pixel" {...register("pixel_event")} placeholder="Lead" className="rounded-lg" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="otp">OTP</Label>
            <select id="otp" {...register("otp_mode")} className="bg-paper h-10 w-full rounded-lg border px-3 text-sm">
              <option value="above_threshold">Only above a price threshold</option>
              <option value="never">Never (lowest friction)</option>
              <option value="always">Always</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="thr">OTP threshold (৳)</Label>
            <Input id="thr" type="number" disabled={otpMode !== "above_threshold"} {...register("otp_threshold_bdt", { valueAsNumber: true })} className="rounded-lg" />
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2 sm:col-span-2">
            <div>
              <Label htmlFor="ab">A/B test (50/50 split by cookie)</Label>
              <p className="text-muted-foreground text-xs">Variant B gets its own block arrangement; conversion is tracked per variant.</p>
            </div>
            <Controller control={control} name="ab_enabled" render={({ field }) => <Switch id="ab" checked={field.value} onCheckedChange={field.onChange} />} />
          </div>
        </section>

        <section className="bg-paper grid gap-3 rounded-2xl border p-4 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">SEO / sharing</h2>
          <div className="space-y-1">
            <Label htmlFor="mt">Meta title</Label>
            <Input id="mt" {...register("meta_title")} className="rounded-lg" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="og">OG image</Label>
            <Controller control={control} name="og_image_url" render={({ field }) => <MediaPicker value={field.value ?? ""} onChange={field.onChange} />} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="md">Meta description</Label>
            <Textarea id="md" rows={2} {...register("meta_description")} className="rounded-lg" />
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="bg-paper space-y-3 rounded-2xl border p-4 text-sm">
          <div className="space-y-1">
            <Label htmlFor="status">Status</Label>
            <select id="status" {...register("status")} className="bg-paper h-10 w-full rounded-lg border px-3 text-sm">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
          <Button type="submit" disabled={pending} className="w-full rounded-lg">{data.page ? "Save" : "Create"}</Button>
          {data.page && (
            <Button type="button" variant="outline" className="text-danger w-full rounded-lg" disabled={pending} onClick={() => confirm("Delete this landing page and its blocks?") && start(async () => { const r = await deleteLandingPageAction(data.page!.id); if (r.ok) router.replace("/admin/landing"); else toast.error(r.error); })}>
              Delete
            </Button>
          )}
        </section>
        {data.page && (
          <section className="bg-paper space-y-2 rounded-2xl border p-4 text-sm">
            <h2 className="font-semibold">Design</h2>
            <p className="text-muted-foreground text-xs">Each variant is a block layout in the page builder.</p>
            <Button asChild variant="outline" className="w-full rounded-lg"><Link href={`/admin/pages/landing/${data.page.id}`}>Variant A blocks ({data.blocksA})</Link></Button>
            {abEnabled && (
              <>
                <Button asChild variant="outline" className="w-full rounded-lg"><Link href={`/admin/pages/landing/${data.page.variant_b_id}`}>Variant B blocks ({data.blocksB})</Link></Button>
                <Button type="button" variant="ghost" className="w-full rounded-lg text-xs" disabled={pending} onClick={() => start(async () => { const r = await copyVariantAction(data.page!.id); if (r.ok) { toast.success(r.message ?? "Copied"); router.refresh(); } else toast.error(r.error); })}>
                  Copy A → B as a starting point
                </Button>
              </>
            )}
            <p className="text-muted-foreground text-xs">Views: A {data.page.views_a} · B {data.page.views_b}</p>
            <p className="flex flex-wrap gap-2 text-xs">
              <a href={`/lp/${data.page.slug}?variant=a`} target="_blank" className="underline">Open A</a>
              {abEnabled && <a href={`/lp/${data.page.slug}?variant=b`} target="_blank" className="underline">Open B</a>}
            </p>
          </section>
        )}
      </aside>
    </form>
  );
}
