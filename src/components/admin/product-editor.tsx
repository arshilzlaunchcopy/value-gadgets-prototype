"use client";

/* eslint-disable @next/next/no-img-element -- admin thumbnails */
import { Plus, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { saveProductAction, saveProductImagesAction } from "@/app/admin/(panel)/products/actions";
import type { ProductPayload } from "@/lib/products/schema";
import type { EditorData, EditorImage } from "@/app/admin/(panel)/products/editor-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { textWidth } from "@/components/admin/serp-preview";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/format";
import { MediaPicker } from "./media-picker";
import { PageHeader } from "./page-header";
import { arrayMove, SortableItem, SortableList } from "./sortable";

function Field({ label, hint, children, id }: { label: string; hint?: string; children: React.ReactNode; id?: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

/** Product editor (§6.2): Details / Variants / Images / SEO / Organization. */
export function ProductEditor({ data }: { data: EditorData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<ProductPayload>({ defaultValues: data.product, mode: "onBlur" });
  const { register, control, handleSubmit, watch, setValue, formState } = form;
  const variants = useFieldArray({ control, name: "variants" });
  const specs = useFieldArray({ control, name: "specs" });
  const [images, setImages] = useState<EditorImage[]>(data.images);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const productId = watch("id");
  const title = watch("title_en");
  const slug = watch("slug");
  const seoTitle = watch("seo.en.meta_title") || `${title || "Product"} - Price in Bangladesh`;
  const seoDesc = watch("seo.en.meta_description") || watch("short_description") || "";
  const titlePx = textWidth(seoTitle, "20px Arial");
  const descPx = textWidth(seoDesc, "14px Arial");

  const submit = handleSubmit((values) =>
    start(async () => {
      const r = await saveProductAction({ ...values, highlights: values.highlights.filter(Boolean) });
      if (r.ok && r.data) {
        toast.success(r.message ?? "Saved");
        if (data.isNew) router.replace(`/admin/products/${r.data.id}`);
        else router.refresh();
      } else if (!r.ok) toast.error(r.error);
    }),
  );

  async function upload(files: FileList | null) {
    if (!files?.length || !productId) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.set("file", f);
        fd.set("product_id", productId);
        fd.set("alt_text_en", `${title} - photo ${images.length + 1}`);
        fd.set("position", String(images.length));
        const res = await fetch("/api/admin/images/upload", { method: "POST", body: fd });
        const j = (await res.json()) as { ok?: boolean; error?: string; image_id?: string; url?: string; width?: number; height?: number };
        if (!res.ok || !j.image_id) throw new Error(j.error ?? "Upload failed");
        setImages((prev) => (prev.some((p) => p.id === j.image_id) ? prev : [...prev, { id: j.image_id!, url: j.url!, alt_text_en: `${title} - photo ${prev.length + 1}`, alt_text_bn: null, variant_id: null, width: j.width ?? null, height: j.height ?? null }]));
        toast.success(`Uploaded ${f.name}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  const saveImages = () =>
    start(async () => {
      const r = await saveProductImagesAction(productId!, images.map((i) => ({ id: i.id, alt_text_en: i.alt_text_en, alt_text_bn: i.alt_text_bn ?? undefined, variant_id: i.variant_id })));
      if (r.ok) toast.success(r.message ?? "Saved");
      else toast.error(r.error);
      router.refresh();
    });

  return (
    <form onSubmit={submit}>
      <PageHeader
        title={data.isNew ? "New product" : title || "Product"}
        description={!data.isNew && slug ? `/products/${slug}` : undefined}
        actions={
          <>
            {!data.isNew && (
              <Button asChild variant="ghost" className="rounded-lg">
                <Link href={`/products/${data.product.slug}`} target="_blank">View</Link>
              </Button>
            )}
            <Button asChild variant="outline" className="rounded-lg">
              <Link href="/admin/products">Back</Link>
            </Button>
            <Button type="submit" disabled={pending} className="rounded-lg">
              {pending ? "Saving…" : "Save"}
            </Button>
          </>
        }
      />
      <Tabs defaultValue="details">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="variants">Variants ({variants.fields.length})</TabsTrigger>
          <TabsTrigger value="images" disabled={data.isNew}>Images ({images.length})</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="org">Organization</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="bg-paper space-y-4 rounded-2xl border p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title (EN)" id="title_en"><Input id="title_en" {...register("title_en", { onBlur: () => !slug && setValue("slug", slugify(title)) })} className="rounded-lg" /></Field>
            <Field label="Title (BN)" id="title_bn"><Input id="title_bn" lang="bn" {...register("title_bn")} className="rounded-lg" /></Field>
            <Field label="Slug" id="slug" hint="Changing the slug of a live product creates a 301 from the old URL."><Input id="slug" {...register("slug")} className="rounded-lg font-mono text-xs" /></Field>
            <Field label="Brand" id="brand_id">
              <select id="brand_id" {...register("brand_id", { setValueAs: (v) => v || null })} className="bg-paper w-full rounded-lg border px-3 py-2 text-sm">
                <option value="">No brand</option>
                {data.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Short description" id="short" hint="Also the default meta description (truncated at 155 characters)."><Textarea id="short" rows={2} {...register("short_description")} className="rounded-lg" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Description (EN, markdown)" id="desc_en"><Textarea id="desc_en" rows={8} {...register("description_en")} className="rounded-lg font-mono text-xs" /></Field>
            <Field label="Description (BN, markdown)" id="desc_bn"><Textarea id="desc_bn" rows={8} lang="bn" {...register("description_bn")} className="rounded-lg text-xs" /></Field>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between"><Label>Spec table</Label><Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => specs.append({ label: "", value: "" })}><Plus className="size-3.5" /> Row</Button></div>
            {specs.fields.map((f, i) => (
              <div key={f.id} className="flex gap-2">
                <Input placeholder="Label" {...register(`specs.${i}.label`)} className="rounded-lg" />
                <Input placeholder="Value" {...register(`specs.${i}.value`)} className="rounded-lg" />
                <button type="button" aria-label="Remove" onClick={() => specs.remove(i)} className="text-muted-foreground hover:text-danger p-2"><Trash2 className="size-4" /></button>
              </div>
            ))}
          </div>
          <Field label="Highlights (one per line)" id="highlights">
            <Controller control={control} name="highlights" render={({ field }) => <Textarea id="highlights" rows={5} value={(field.value ?? []).join("\n")} onChange={(e) => field.onChange(e.target.value.split("\n"))} className="rounded-lg" />} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Status" id="status">
              <select id="status" {...register("status")} className="bg-paper w-full rounded-lg border px-3 py-2 text-sm"><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select>
            </Field>
            <Field label="Warranty (months)" id="warranty"><Input id="warranty" type="number" min={0} {...register("warranty_months", { valueAsNumber: true })} className="rounded-lg" /></Field>
            <Field label="Video URL" id="video"><Input id="video" {...register("video_url")} className="rounded-lg" /></Field>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2"><Label htmlFor="featured">Featured</Label><Controller control={control} name="is_featured" render={({ field }) => <Switch id="featured" checked={field.value} onCheckedChange={field.onChange} />} /></div>
          </div>
        </TabsContent>

        <TabsContent value="variants" className="bg-paper space-y-3 rounded-2xl border p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">Prices in whole taka. Cost is admin-only and never leaves this screen.</p>
            <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => variants.append({ sku: "", option_name: variants.fields[0] ? watch("variants.0.option_name") : "Color", option_value: "", price_bdt: watch("variants.0.price_bdt") ?? 0, compare_at_price_bdt: null, cost_bdt: null, stock_qty: 0, low_stock_threshold: 5, weight_grams: null, gtin: "", mpn: "", is_default: false })}><Plus className="size-3.5" /> Variant</Button>
          </div>
          <SortableList ids={variants.fields.map((f) => f.id)} onReorder={(f, t) => variants.move(f, t)}>
            <div className="space-y-2">
              {variants.fields.map((f, i) => (
                <SortableItem key={f.id} id={f.id} className="bg-paper-soft rounded-lg border p-2">
                  {(handle) => (
                    <div className="grid items-end gap-2 sm:grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_1fr_auto]">
                      <div className="pb-2">{handle}</div>
                      <Field label="SKU"><Input {...register(`variants.${i}.sku`)} className="rounded-lg font-mono text-xs" /></Field>
                      <Field label="GTIN / barcode"><Input placeholder="13 digits" inputMode="numeric" {...register(`variants.${i}.gtin`)} className="rounded-lg font-mono text-xs" /></Field>
                      <Field label="MPN"><Input placeholder="Manufacturer part no." {...register(`variants.${i}.mpn`)} className="rounded-lg text-xs" /></Field>
                      <Field label="Option"><Input placeholder="Color" {...register(`variants.${i}.option_name`)} className="rounded-lg" /></Field>
                      <Field label="Value"><Input placeholder="Black" {...register(`variants.${i}.option_value`)} className="rounded-lg" /></Field>
                      <Field label="Price ৳"><Input type="number" min={0} {...register(`variants.${i}.price_bdt`, { valueAsNumber: true })} className="rounded-lg" /></Field>
                      <Field label="Compare ৳"><Input type="number" min={0} {...register(`variants.${i}.compare_at_price_bdt`, { setValueAs: (v) => (v === "" || v === null ? null : Number(v)) })} className="rounded-lg" /></Field>
                      <Field label="Cost ৳"><Input type="number" min={0} {...register(`variants.${i}.cost_bdt`, { setValueAs: (v) => (v === "" || v === null ? null : Number(v)) })} className="rounded-lg" /></Field>
                      <Field label="Stock"><Input type="number" min={0} {...register(`variants.${i}.stock_qty`, { valueAsNumber: true })} className="rounded-lg" /></Field>
                      <div className="flex items-center gap-2 pb-2">
                        <label className="flex items-center gap-1 text-xs"><input type="radio" name="default_variant" checked={watch(`variants.${i}.is_default`)} onChange={() => variants.fields.forEach((_, k) => setValue(`variants.${k}.is_default`, k === i))} className="accent-amber" /> default</label>
                        <button type="button" aria-label="Remove variant" disabled={variants.fields.length <= 1} onClick={() => variants.remove(i)} className="text-muted-foreground hover:text-danger disabled:opacity-40"><Trash2 className="size-4" /></button>
                      </div>
                    </div>
                  )}
                </SortableItem>
              ))}
            </div>
          </SortableList>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Low-stock threshold (all variants)" id="threshold"><Input id="threshold" type="number" min={0} defaultValue={data.product.variants[0]?.low_stock_threshold ?? 5} onChange={(e) => variants.fields.forEach((_, k) => setValue(`variants.${k}.low_stock_threshold`, Number(e.target.value) || 0))} className="rounded-lg" /></Field>
          </div>
        </TabsContent>

        <TabsContent value="images" className="bg-paper space-y-3 rounded-2xl border p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
            <Button type="button" variant="outline" className="rounded-lg" disabled={uploading || !productId} onClick={() => fileRef.current?.click()}><Upload className="size-4" /> {uploading ? "Processing…" : "Upload images"}</Button>
            <Button type="button" className="rounded-lg" disabled={pending || !productId} onClick={saveImages}>Save image order & alt text</Button>
            <span className="text-muted-foreground text-xs">Uploads are compressed to AVIF/WebP (up to 1920px) with a blur placeholder; dimensions auto-fill.</span>
          </div>
          <SortableList ids={images.map((i) => i.id)} onReorder={(f, t) => setImages((prev) => arrayMove(prev, f, t))}>
            <ul className="grid gap-2 sm:grid-cols-2">
              {images.map((img, i) => (
                <li key={img.id}>
                  <SortableItem id={img.id} className="bg-paper-soft flex gap-3 rounded-lg border p-2">
                    {(handle) => (
                      <>
                        <div className="flex flex-col items-center gap-1">{handle}<span className="text-muted-foreground text-[10px]">{i === 0 ? "main" : i + 1}</span></div>
                        <img src={img.url} alt="" className="size-20 shrink-0 rounded-lg object-cover" />
                        <div className="min-w-0 flex-1 space-y-1">
                          <Input value={img.alt_text_en} onChange={(e) => setImages((p) => p.map((x) => (x.id === img.id ? { ...x, alt_text_en: e.target.value } : x)))} placeholder="Alt text (EN)" className="rounded-lg text-xs" />
                          <Input value={img.alt_text_bn ?? ""} lang="bn" onChange={(e) => setImages((p) => p.map((x) => (x.id === img.id ? { ...x, alt_text_bn: e.target.value } : x)))} placeholder="Alt text (BN)" className="rounded-lg text-xs" />
                          <select value={img.variant_id ?? ""} onChange={(e) => setImages((p) => p.map((x) => (x.id === img.id ? { ...x, variant_id: e.target.value || null } : x)))} className="bg-paper w-full rounded-lg border px-2 py-1 text-xs">
                            <option value="">All variants</option>
                            {data.product.variants.filter((v) => v.id).map((v) => <option key={v.id} value={v.id}>{v.option_value || v.sku}</option>)}
                          </select>
                          <p className="text-muted-foreground text-[10px]">{img.width}×{img.height}</p>
                        </div>
                        <button type="button" aria-label="Remove image" onClick={() => setImages((p) => p.filter((x) => x.id !== img.id))} className="text-muted-foreground hover:text-danger self-start p-1"><Trash2 className="size-4" /></button>
                      </>
                    )}
                  </SortableItem>
                </li>
              ))}
            </ul>
          </SortableList>
          {images.length === 0 && <p className="text-muted-foreground text-sm">No images yet.</p>}
        </TabsContent>

        <TabsContent value="seo" className="grid gap-4 lg:grid-cols-2">
          <div className="bg-paper space-y-4 rounded-2xl border p-4 sm:p-6">
            {(["en", "bn"] as const).map((l) => (
              <fieldset key={l} className="space-y-3 rounded-lg border p-3">
                <legend className="px-1 text-sm font-medium uppercase">{l}</legend>
                <Field label="Meta title" hint={l === "en" ? `${Math.round(titlePx)} px ${titlePx > 580 ? "- too long, Google truncates around 580 px" : "(fits)"}` : undefined}><Input {...register(`seo.${l}.meta_title`)} lang={l} className="rounded-lg" /></Field>
                <Field label="Meta description" hint={l === "en" ? `${Math.round(descPx)} px ${descPx > 920 ? "- too long, truncates around 920 px" : "(fits)"}` : undefined}><Textarea rows={3} {...register(`seo.${l}.meta_description`)} lang={l} className="rounded-lg" /></Field>
                <Field label="OG image"><Controller control={control} name={`seo.${l}.og_image_url`} render={({ field }) => <MediaPicker value={field.value ?? ""} onChange={field.onChange} />} /></Field>
                <Field label="Robots"><select {...register(`seo.${l}.robots`)} className="bg-paper w-full rounded-lg border px-3 py-2 text-sm"><option value="index,follow">index, follow</option><option value="noindex,follow">noindex, follow</option><option value="noindex,nofollow">noindex, nofollow</option></select></Field>
              </fieldset>
            ))}
          </div>
          <div className="bg-paper h-fit rounded-2xl border p-4 sm:p-6">
            <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase">Live SERP preview</p>
            <div className="max-w-[600px] rounded-lg border p-3" style={{ fontFamily: "Arial, sans-serif" }}>
              <p className="text-xs text-[#202124]">valuegadgetsbd.com › products › {slug || "slug"}</p>
              <p className={`mt-1 truncate text-[20px] text-[#1a0dab] ${titlePx > 580 ? "text-danger" : ""}`}>{seoTitle}</p>
              <p className="mt-1 line-clamp-2 text-[14px] text-[#4d5156]">{seoDesc.slice(0, 200)}</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="org" className="bg-paper grid gap-6 rounded-2xl border p-4 sm:grid-cols-2 sm:p-6">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Categories</legend>
            <Controller control={control} name="category_ids" render={({ field }) => (
              <ul className="space-y-1">{data.categories.map((c) => (
                <li key={c.id}><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={field.value.includes(c.id)} onChange={(e) => field.onChange(e.target.checked ? [...field.value, c.id] : field.value.filter((x) => x !== c.id))} className="accent-amber" />{c.name_en}</label></li>
              ))}</ul>
            )} />
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Collections</legend>
            <Controller control={control} name="collection_ids" render={({ field }) => (
              <ul className="space-y-1">{data.collections.map((c) => (
                <li key={c.id}><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={field.value.includes(c.id)} onChange={(e) => field.onChange(e.target.checked ? [...field.value, c.id] : field.value.filter((x) => x !== c.id))} className="accent-amber" />{c.title_en}</label></li>
              ))}</ul>
            )} />
          </fieldset>
        </TabsContent>
      </Tabs>
      {Object.keys(formState.errors).length > 0 && <p className="text-danger mt-3 text-sm">Some fields need attention: {Object.keys(formState.errors).join(", ")}</p>}
    </form>
  );
}
