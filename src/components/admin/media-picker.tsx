"use client";

/* eslint-disable @next/next/no-img-element -- media library thumbnails */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ImagePlus, Trash2, Upload } from "lucide-react";
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

async function fetchMedia(q: string, folder: string): Promise<MediaItem[]> {
  const res = await fetch(`/api/admin/media?limit=120${q ? `&q=${encodeURIComponent(q)}` : ""}${folder ? `&folder=${encodeURIComponent(folder)}` : ""}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load media");
  return ((await res.json()) as { items: MediaItem[] }).items;
}

const FOLDERS = ["general", "banners", "brands", "posts", "landing"];

/**
 * Grid + upload + detail (alt text, folder, copy URL, delete). Used standalone
 * on /admin/media and inside MediaPicker (BUILD_PROMPT §6.2 media library).
 */
export function MediaLibrary({ onSelect, folder: uploadFolder = "general", manage = false }: { onSelect?: (item: MediaItem) => void; folder?: string; manage?: boolean }) {
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState("");
  const [active, setActive] = useState<MediaItem | null>(null);
  const [alt, setAlt] = useState("");
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["media", q, folder], queryFn: () => fetchMedia(q, folder) });
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.set("file", f);
        fd.set("folder", folder || uploadFolder);
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

  async function saveMeta(item: MediaItem, patch: { alt_text?: string; folder?: string }) {
    const res = await fetch(`/api/admin/media/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (!res.ok) return toast.error("Could not save");
    toast.success("Saved");
    await qc.invalidateQueries({ queryKey: ["media"] });
    setActive({ ...item, ...patch, alt_text: patch.alt_text ?? item.alt_text });
  }

  async function remove(item: MediaItem) {
    if (!confirm(`Remove ${item.filename ?? "this image"} from the library? Pages that still reference it keep working.`)) return;
    const res = await fetch(`/api/admin/media/${item.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Could not delete");
    toast.success("Removed");
    setActive(null);
    await qc.invalidateQueries({ queryKey: ["media"] });
  }

  const pick = (m: MediaItem) => {
    if (onSelect) return onSelect(m);
    setActive(m);
    setAlt(m.alt_text ?? "");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search filename or alt text" className="max-w-xs rounded-lg" />
        <select value={folder} onChange={(e) => setFolder(e.target.value)} className="bg-paper rounded-lg border px-3 py-2 text-sm" aria-label="Folder">
          <option value="">All folders</option>
          {FOLDERS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
        <Button type="button" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()} className="rounded-lg">
          <Upload className="size-4" /> {uploading ? "Uploading…" : "Upload"}
        </Button>
        <span className="text-muted-foreground text-xs">AVIF + WebP at 6 widths, JPEG fallback, blur placeholder.</span>
      </div>
      <div className={manage ? "grid gap-4 lg:grid-cols-[1fr_280px]" : ""}>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : !data?.length ? (
          <p className="text-muted-foreground text-sm">No media yet. Upload an image to get started.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {data.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => pick(m)} className={`bg-paper hover:ring-amber group block w-full overflow-hidden rounded-lg border text-left ring-2 ${active?.id === m.id ? "ring-amber" : "ring-transparent"}`} title={m.alt_text ?? m.filename ?? ""}>
                  <img src={m.url} alt={m.alt_text ?? ""} className="aspect-square w-full object-cover" loading="lazy" />
                  <span className="block truncate px-1.5 py-1 text-[11px]">{m.filename ?? m.alt_text}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {manage && (
          <aside className="bg-paper-soft h-fit space-y-2 rounded-lg border p-3 text-sm">
            {!active ? (
              <p className="text-muted-foreground text-xs">Select an image to edit its alt text, move it to a folder, copy its URL or remove it.</p>
            ) : (
              <>
                <img src={active.url} alt={active.alt_text ?? ""} className="aspect-video w-full rounded-lg object-cover" />
                <p className="truncate text-xs font-medium">{active.filename}</p>
                <p className="text-muted-foreground text-xs">{active.width}×{active.height} · {active.bytes ? `${Math.round(active.bytes / 1024)} KB` : ""} · {active.folder}</p>
                <Input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Alt text" className="rounded-lg text-xs" aria-label="Alt text" />
                <div className="flex gap-2">
                  <Button size="sm" className="rounded-lg" onClick={() => saveMeta(active, { alt_text: alt })}>Save alt</Button>
                  <select value={active.folder} onChange={(e) => saveMeta(active, { folder: e.target.value })} className="bg-paper rounded-lg border px-2 py-1 text-xs" aria-label="Move to folder">
                    {FOLDERS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => navigator.clipboard.writeText(active.url).then(() => toast.success("URL copied"))}><Copy className="size-3.5" /> Copy URL</Button>
                  <Button size="sm" variant="outline" className="text-danger rounded-lg" onClick={() => remove(active)}><Trash2 className="size-3.5" /> Remove</Button>
                </div>
              </>
            )}
          </aside>
        )}
      </div>
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
