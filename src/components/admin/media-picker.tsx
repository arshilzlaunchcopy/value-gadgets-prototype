"use client";

/* eslint-disable @next/next/no-img-element -- media library thumbnails */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export interface MediaItem {
  id: string;
  url: string;
  alt_text: string | null;
  filename: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  folder: string;
  created_at: string;
}

async function fetchMedia(q: string): Promise<MediaItem[]> {
  const res = await fetch(`/api/admin/media?limit=120${q ? `&q=${encodeURIComponent(q)}` : ""}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load media");
  return ((await res.json()) as { items: MediaItem[] }).items;
}

/** Grid + upload. Used standalone on /admin/media and inside MediaPicker. */
export function MediaLibrary({ onSelect, folder = "general" }: { onSelect?: (item: MediaItem) => void; folder?: string }) {
  const [q, setQ] = useState("");
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["media", q], queryFn: () => fetchMedia(q) });
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.set("file", f);
        fd.set("folder", folder);
        const res = await fetch("/api/admin/media", { method: "POST", body: fd });
        const json = (await res.json()) as { ok?: boolean; error?: string; item?: MediaItem };
        if (!res.ok || !json.item) throw new Error(json.error ?? "Upload failed");
        toast.success(`Uploaded ${f.name}`);
        if (onSelect && files.length === 1) onSelect(json.item);
      }
      await qc.invalidateQueries({ queryKey: ["media"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search filename or alt text" className="max-w-xs rounded-lg" />
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
        <Button type="button" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()} className="rounded-lg">
          <Upload className="size-4" /> {uploading ? "Uploading…" : "Upload"}
        </Button>
        <span className="text-muted-foreground text-xs">Images go through the pipeline: AVIF + WebP at 6 widths, JPEG fallback, blur placeholder.</span>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : !data?.length ? (
        <p className="text-muted-foreground text-sm">No media yet. Upload an image to get started.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {data.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => onSelect?.(m)} className="bg-paper hover:ring-amber group block w-full overflow-hidden rounded-lg border text-left ring-2 ring-transparent" title={m.alt_text ?? m.filename ?? ""}>
                <img src={m.url} alt={m.alt_text ?? ""} className="aspect-square w-full object-cover" loading="lazy" />
                <span className="block truncate px-1.5 py-1 text-[11px]">{m.filename ?? m.alt_text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Input + "Choose" dialog for image fields in generated forms. Stores the JPEG fallback URL. */
export function MediaPicker({ value, onChange, label }: { value: string; onChange: (url: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-start gap-2">
      <div className="bg-paper-line size-14 shrink-0 overflow-hidden rounded-lg">{value ? <img src={value} alt="" className="size-full object-cover" /> : <ImagePlus className="text-muted-foreground m-4 size-6" />}</div>
      <div className="min-w-0 flex-1 space-y-1">
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://… or choose from the library" className="rounded-lg text-xs" aria-label={label ?? "Image URL"} />
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => setOpen(true)}>
            Choose
          </Button>
          {value && (
            <Button type="button" size="sm" variant="ghost" className="rounded-lg" onClick={() => onChange("")}>
              Clear
            </Button>
          )}
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Media library</DialogTitle>
            <DialogDescription>Pick an image or upload a new one.</DialogDescription>
          </DialogHeader>
          <MediaLibrary
            onSelect={(m) => {
              onChange(m.url);
              setOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
