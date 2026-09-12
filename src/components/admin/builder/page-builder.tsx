"use client";

import { CalendarClock, Copy, Eye, EyeOff, History, Monitor, Plus, Save, Settings2, Smartphone, Tablet, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { discardDraftAction, getRevisionAction, listRevisionsAction, publishPageAction, saveDraftAction, saveRevisionAction, type RevisionSummary } from "@/app/admin/(panel)/pages/actions";
import type { BuilderInitial } from "@/app/admin/(panel)/pages/[pageType]/builder-loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { BlockRow } from "@/lib/blocks/define";
import type { BlockMeta } from "@/lib/blocks/registry";
import { SchemaForm } from "../schema-form";
import { arrayMove, SortableItem, SortableList } from "../sortable";

type Viewport = "mobile" | "tablet" | "desktop";
const WIDTHS: Record<Viewport, number> = { mobile: 375, tablet: 768, desktop: 1280 };

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Page builder (PART2 §13.7): block list with drag handles left, live preview
 * iframe right, settings panel per block, draft autosave, publish, revisions.
 */
export function PageBuilder({ initial }: { initial: BuilderInitial }) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<BlockRow[]>(initial.blocks);
  const [dirty, setDirty] = useState(initial.hasDraft);
  const [savedAt, setSavedAt] = useState<string | null>(initial.draftUpdatedAt);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [revisions, setRevisions] = useState<RevisionSummary[] | null>(null);
  const [revOpen, setRevOpen] = useState(false);
  const [pending, start] = useTransition();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metaByType = useMemo(() => new Map(initial.blockMetas.map((m) => [m.type, m])), [initial.blockMetas]);

  const reloadPreview = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.location.reload();
    } catch {
      if (iframeRef.current) iframeRef.current.src = initial.previewUrl;
    }
  }, [initial.previewUrl]);

  const saveDraft = useCallback(
    (rows: BlockRow[]) =>
      start(async () => {
        const r = await saveDraftAction(initial.pageType, initial.targetId, rows);
        if (r.ok) {
          setSavedAt(r.data?.savedAt ?? new Date().toISOString());
          reloadPreview();
        } else toast.error(r.error);
      }),
    [initial.pageType, initial.targetId, reloadPreview],
  );

  // autosave 1.2 s after the last change
  const update = useCallback(
    (next: BlockRow[] | ((prev: BlockRow[]) => BlockRow[])) => {
      setBlocks((prev) => {
        const rows = typeof next === "function" ? next(prev) : next;
        setDirty(true);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => saveDraft(rows), 1200);
        return rows;
      });
    },
    [saveDraft],
  );
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  const addBlock = (meta: BlockMeta) => {
    update((prev) => [...prev, { id: newId(), block_type: meta.type, settings: structuredClone(meta.defaults), is_visible: true, visible_from: null, visible_until: null, locale: null }]);
    setAdding(false);
  };
  const duplicate = (id: string) =>
    update((prev) => {
      const i = prev.findIndex((b) => b.id === id);
      if (i < 0) return prev;
      const copy = { ...structuredClone(prev[i]), id: newId() };
      return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)];
    });
  const remove = (id: string) => {
    update((prev) => prev.filter((b) => b.id !== id));
    if (selected === id) setSelected(null);
  };
  const patch = (id: string, p: Partial<BlockRow>) => update((prev) => prev.map((b) => (b.id === id ? { ...b, ...p } : b)));

  const publish = () =>
    start(async () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const r = await publishPageAction(initial.pageType, initial.targetId, blocks);
      if (r.ok) {
        setDirty(false);
        setSavedAt(null);
        toast.success(`Published ${r.data?.count ?? blocks.length} block(s)`);
        reloadPreview();
        router.refresh();
      } else toast.error(r.error);
    });

  const discard = () =>
    start(async () => {
      if (!confirm("Discard the draft and reload the published layout?")) return;
      const r = await discardDraftAction(initial.pageType, initial.targetId);
      if (r.ok) {
        toast.success("Draft discarded");
        router.refresh();
        window.location.reload();
      } else toast.error(r.error);
    });

  const openRevisions = () =>
    start(async () => {
      const r = await listRevisionsAction(initial.pageType, initial.targetId);
      if (r.ok) {
        setRevisions(r.data ?? []);
        setRevOpen(true);
      } else toast.error(r.error);
    });
  const restore = (id: string) =>
    start(async () => {
      const r = await getRevisionAction(id);
      if (r.ok && r.data) {
        update(r.data.map((b) => ({ ...b, id: newId() })));
        setRevOpen(false);
        toast.success("Revision loaded into the draft. Publish to make it live.");
      } else if (!r.ok) toast.error(r.error);
    });
  const namedSave = () =>
    start(async () => {
      const label = prompt("Name this save point", "Before campaign")?.trim();
      if (!label) return;
      const r = await saveRevisionAction(initial.pageType, initial.targetId, blocks, label);
      if (r.ok) toast.success("Save point created");
      else toast.error(r.error);
    });

  const selectedBlock = blocks.find((b) => b.id === selected) ?? null;
  const selectedMeta = selectedBlock ? metaByType.get(selectedBlock.block_type) : undefined;
  const title = initial.targetLabel ? `${initial.pageType} · ${initial.targetLabel}` : `${initial.pageType} template`;

  return (
    <div className="-m-4 flex h-[calc(100dvh)] flex-col sm:-m-6">
      {/* toolbar */}
      <div className="bg-paper flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <Link href="/admin/pages" className="text-muted-foreground text-sm hover:underline">
          Pages
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-sm font-semibold capitalize">{title}</h1>
        <Badge variant="outline" className="rounded-lg">
          {dirty ? (savedAt ? `Draft saved ${new Date(savedAt).toLocaleTimeString()}` : "Unsaved changes") : `${initial.publishedCount} live`}
        </Badge>
        {pending && <span className="text-muted-foreground text-xs">Working…</span>}
        <div className="ml-auto flex items-center gap-1">
          <div className="mr-2 inline-flex rounded-lg border p-0.5" role="group" aria-label="Preview width">
            {(["mobile", "tablet", "desktop"] as Viewport[]).map((v) => {
              const Icon = v === "mobile" ? Smartphone : v === "tablet" ? Tablet : Monitor;
              return (
                <button key={v} type="button" onClick={() => setViewport(v)} aria-pressed={viewport === v} title={`${v} (${WIDTHS[v]}px)`} className={`rounded-md p-1.5 ${viewport === v ? "bg-ink text-paper" : "hover:bg-accent"}`}>
                  <Icon className="size-4" />
                </button>
              );
            })}
          </div>
          <Button size="sm" variant="ghost" className="rounded-lg" onClick={openRevisions} disabled={pending}>
            <History className="size-4" /> Revisions
          </Button>
          <Button size="sm" variant="ghost" className="rounded-lg" onClick={namedSave} disabled={pending}>
            <Save className="size-4" /> Save point
          </Button>
          {dirty && (
            <Button size="sm" variant="outline" className="rounded-lg" onClick={discard} disabled={pending}>
              Discard draft
            </Button>
          )}
          <Button size="sm" className="rounded-lg" onClick={publish} disabled={pending || blocks.length === 0}>
            <Upload className="size-4" /> Publish
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[360px_1fr]">
        {/* block list */}
        <aside className="bg-paper-soft flex min-h-0 flex-col border-r">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm font-semibold">Blocks ({blocks.length})</span>
            <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setAdding(true)}>
              <Plus className="size-4" /> Add block
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {blocks.length === 0 && <p className="text-muted-foreground p-4 text-center text-sm">No blocks yet. Add one to start composing.</p>}
            <SortableList ids={blocks.map((b) => b.id)} onReorder={(from, to) => update((prev) => arrayMove(prev, from, to))}>
              <ul className="space-y-1.5">
                {blocks.map((b) => {
                  const meta = metaByType.get(b.block_type);
                  const scheduled = b.visible_from || b.visible_until;
                  return (
                    <li key={b.id}>
                      <SortableItem id={b.id} className={`bg-paper rounded-lg border ${selected === b.id ? "ring-amber ring-2" : ""} ${!b.is_visible ? "opacity-60" : ""}`}>
                        {(handle) => (
                          <div className="flex items-center gap-1 px-1.5 py-1">
                            {handle}
                            <button type="button" onClick={() => setSelected(b.id)} className="min-w-0 flex-1 truncate text-left text-sm">
                              <span className="font-medium">{meta?.label ?? b.block_type}</span>
                              {scheduled && <CalendarClock className="text-warn-deep ml-1 inline size-3.5" />}
                              {!meta && <span className="text-danger ml-1 text-xs">(unknown type)</span>}
                            </button>
                            <button type="button" title={b.is_visible ? "Hide" : "Show"} onClick={() => patch(b.id, { is_visible: !b.is_visible })} className="hover:bg-accent rounded p-1">
                              {b.is_visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                            </button>
                            <button type="button" title="Duplicate" onClick={() => duplicate(b.id)} className="hover:bg-accent rounded p-1">
                              <Copy className="size-3.5" />
                            </button>
                            <button type="button" title="Settings" onClick={() => setSelected(b.id)} className="hover:bg-accent rounded p-1">
                              <Settings2 className="size-3.5" />
                            </button>
                            <button type="button" title="Delete" onClick={() => remove(b.id)} className="hover:text-danger hover:bg-accent rounded p-1">
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        )}
                      </SortableItem>
                    </li>
                  );
                })}
              </ul>
            </SortableList>
          </div>
        </aside>

        {/* preview */}
        <div className="bg-ink-line/20 flex min-h-0 items-start justify-center overflow-auto p-4">
          <iframe ref={iframeRef} title="Live preview" src={initial.previewUrl} style={{ width: WIDTHS[viewport], maxWidth: "100%" }} className="bg-paper h-full min-h-[70vh] rounded-xl border shadow-sm transition-[width]" />
        </div>
      </div>

      {/* add block */}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add a block</DialogTitle>
            <DialogDescription>Blocks allowed on {initial.pageType} pages.</DialogDescription>
          </DialogHeader>
          <ul className="grid gap-2 sm:grid-cols-2">
            {initial.blockMetas.map((m) => (
              <li key={m.type}>
                <button type="button" onClick={() => addBlock(m)} className="bg-paper hover:border-ink w-full rounded-lg border p-3 text-left">
                  <span className="block font-medium">{m.label}</span>
                  {m.description && <span className="text-muted-foreground block text-xs">{m.description}</span>}
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      {/* settings panel */}
      <Sheet open={Boolean(selectedBlock)} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
          {selectedBlock && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedMeta?.label ?? selectedBlock.block_type}</SheetTitle>
                <SheetDescription>{selectedMeta?.description ?? "Block settings"}</SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-6">
                {selectedMeta ? (
                  <SchemaForm key={selectedBlock.id} idPrefix={selectedBlock.id.slice(0, 6)} fields={selectedMeta.fields} values={selectedBlock.settings} onChange={(v) => patch(selectedBlock.id, { settings: v })} />
                ) : (
                  <p className="text-danger text-sm">This block type is no longer registered.</p>
                )}
                <fieldset className="space-y-3 rounded-lg border p-3">
                  <legend className="px-1 text-sm font-medium">Visibility &amp; schedule</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="vf">Visible from</Label>
                      <Input id="vf" type="datetime-local" value={toLocal(selectedBlock.visible_from)} onChange={(e) => patch(selectedBlock.id, { visible_from: fromLocal(e.target.value) })} className="rounded-lg" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="vu">Visible until</Label>
                      <Input id="vu" type="datetime-local" value={toLocal(selectedBlock.visible_until)} onChange={(e) => patch(selectedBlock.id, { visible_until: fromLocal(e.target.value) })} className="rounded-lg" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="loc">Language</Label>
                    <select id="loc" value={selectedBlock.locale ?? ""} onChange={(e) => patch(selectedBlock.id, { locale: (e.target.value || null) as BlockRow["locale"] })} className="bg-paper w-full rounded-lg border px-3 py-2 text-sm">
                      <option value="">Both languages</option>
                      <option value="en">English only</option>
                      <option value="bn">Bangla only</option>
                    </select>
                  </div>
                </fieldset>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* revisions */}
      <Dialog open={revOpen} onOpenChange={setRevOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revision history</DialogTitle>
            <DialogDescription>Every publish and named save point. Restoring loads the snapshot into the draft.</DialogDescription>
          </DialogHeader>
          {!revisions?.length ? (
            <p className="text-muted-foreground text-sm">No revisions yet.</p>
          ) : (
            <ul className="max-h-[60vh] divide-y overflow-y-auto text-sm">
              {revisions.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="font-medium">{r.label ?? "Published"}</p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(r.created_at).toLocaleString()} · {r.block_count} block{r.block_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-lg" disabled={pending} onClick={() => restore(r.id)}>
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function toLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocal(v: string): string | null {
  return v ? new Date(v).toISOString() : null;
}
