"use client";

import { ChevronRight, Plus, Settings2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { SchemaForm } from "@/components/admin/schema-form";
import { arrayMove, SortableItem, SortableList } from "@/components/admin/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { FieldSpec } from "@/lib/blocks/fields";
import type { NavTreeNode } from "@/lib/navigation/schema";
import { createMenuAction, saveMenuTreeAction } from "./actions";

interface Menu {
  handle: string;
  title: string;
  tree: NavTreeNode[];
}

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `n-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const blank = (label = "New link"): NavTreeNode => ({ id: newId(), label_en: label, label_bn: "", link_type: "category", link_target: "", icon: "", badge_label: "", badge_color: "", opens_new_tab: false, is_mega: false, mega_layout: { columns: [], featured: { image_url: "", heading: "", href: "" } }, children: [] });

/** Two-level tree editor per menu; item settings (incl. mega-menu panel) use the schema-derived form. */
export function NavigationEditor({ menus: initial, itemFields }: { menus: Menu[]; itemFields: FieldSpec[] }) {
  const router = useRouter();
  const [menus, setMenus] = useState(initial);
  const [handle, setHandle] = useState(initial.find((m) => m.handle === "main")?.handle ?? initial[0]?.handle ?? "");
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<{ id: string; parentId: string | null } | null>(null);
  const [pending, start] = useTransition();
  const menu = useMemo(() => menus.find((m) => m.handle === handle), [menus, handle]);
  const topFields = itemFields;
  const childFields = itemFields.filter((f) => f.name !== "is_mega" && f.name !== "mega_layout");

  const setTree = (fn: (t: NavTreeNode[]) => NavTreeNode[]) => {
    setMenus((prev) => prev.map((m) => (m.handle === handle ? { ...m, tree: fn(m.tree) } : m)));
    setDirty(true);
  };
  const updateNode = (id: string, parentId: string | null, patch: Partial<NavTreeNode>) =>
    setTree((t) => (parentId === null ? t.map((n) => (n.id === id ? { ...n, ...patch } : n)) : t.map((n) => (n.id === parentId ? { ...n, children: n.children.map((c) => (c.id === id ? { ...c, ...patch } : c)) } : n))));
  const removeNode = (id: string, parentId: string | null) =>
    setTree((t) => (parentId === null ? t.filter((n) => n.id !== id) : t.map((n) => (n.id === parentId ? { ...n, children: n.children.filter((c) => c.id !== id) } : n))));

  const save = () =>
    start(async () => {
      if (!menu) return;
      const r = await saveMenuTreeAction(menu.handle, menu.tree);
      if (r.ok) {
        toast.success("Menu published");
        setDirty(false);
        router.refresh();
      } else toast.error(r.error ?? "Could not save");
    });

  const addMenu = () =>
    start(async () => {
      const h = prompt("Menu handle (e.g. footer_col_3)")?.trim();
      if (!h) return;
      const r = await createMenuAction(h, h.replace(/_/g, " "));
      if (r.ok) {
        toast.success("Menu created");
        router.refresh();
      } else toast.error(r.error ?? "Could not create");
    });

  const editingNode = editing ? (editing.parentId === null ? menu?.tree.find((n) => n.id === editing.id) : menu?.tree.find((n) => n.id === editing.parentId)?.children.find((c) => c.id === editing.id)) : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <aside className="bg-paper h-fit rounded-2xl border p-2">
        <ul className="space-y-0.5">
          {menus.map((m) => (
            <li key={m.handle}>
              <button type="button" onClick={() => { if (dirty && !confirm("Discard unsaved changes to this menu?")) return; setHandle(m.handle); setDirty(false); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${m.handle === handle ? "bg-ink text-paper" : "hover:bg-accent"}`}>
                <span className="truncate">{m.title}</span>
                <span className="text-xs opacity-60">{m.tree.length}</span>
              </button>
            </li>
          ))}
        </ul>
        <Button variant="ghost" size="sm" className="mt-2 w-full rounded-lg" onClick={addMenu} disabled={pending}>
          <Plus className="size-4" /> New menu
        </Button>
      </aside>

      {menu ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{menu.title}</h2>
            <code className="bg-muted rounded px-1.5 py-0.5 text-xs">{menu.handle}</code>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setTree((t) => [...t, blank()])}>
                <Plus className="size-4" /> Add item
              </Button>
              <Button size="sm" className="rounded-lg" disabled={pending || !dirty} onClick={save}>
                {pending ? "Saving…" : "Save & publish"}
              </Button>
            </div>
          </div>

          <SortableList ids={menu.tree.map((n) => n.id)} onReorder={(f, t) => setTree((tree) => arrayMove(tree, f, t))}>
            <ul className="space-y-2">
              {menu.tree.map((n) => (
                <li key={n.id}>
                  <SortableItem id={n.id} className="bg-paper rounded-xl border">
                    {(handleEl) => (
                      <div>
                        <div className="flex items-center gap-1 px-2 py-1.5">
                          {handleEl}
                          <button type="button" onClick={() => setEditing({ id: n.id, parentId: null })} className="min-w-0 flex-1 truncate text-left text-sm font-medium">
                            {n.label_en}
                            <span className="text-muted-foreground ml-2 text-xs">{n.link_type}{n.link_target ? `: ${n.link_target}` : ""}</span>
                            {n.is_mega && <span className="bg-amber/30 ml-2 rounded px-1 text-[10px] font-semibold">MEGA</span>}
                            {n.badge_label && <span className="ml-2 rounded px-1 text-[10px] font-semibold" style={{ backgroundColor: n.badge_color || "#FFC107" }}>{n.badge_label}</span>}
                          </button>
                          <button type="button" title="Add child link" onClick={() => setTree((t) => t.map((x) => (x.id === n.id ? { ...x, children: [...x.children, blank("Sub link")] } : x)))} className="hover:bg-accent rounded p-1">
                            <Plus className="size-3.5" />
                          </button>
                          <button type="button" title="Edit" onClick={() => setEditing({ id: n.id, parentId: null })} className="hover:bg-accent rounded p-1">
                            <Settings2 className="size-3.5" />
                          </button>
                          <button type="button" title="Delete" onClick={() => removeNode(n.id, null)} className="hover:text-danger hover:bg-accent rounded p-1">
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                        {n.children.length > 0 && (
                          <SortableList ids={n.children.map((c) => c.id)} onReorder={(f, t) => setTree((tree) => tree.map((x) => (x.id === n.id ? { ...x, children: arrayMove(x.children, f, t) } : x)))}>
                            <ul className="space-y-1 border-t px-2 py-1.5 pl-6">
                              {n.children.map((c) => (
                                <li key={c.id}>
                                  <SortableItem id={c.id} className="bg-paper-soft rounded-lg border">
                                    {(h2) => (
                                      <div className="flex items-center gap-1 px-2 py-1">
                                        {h2}
                                        <ChevronRight className="text-muted-foreground size-3" />
                                        <button type="button" onClick={() => setEditing({ id: c.id, parentId: n.id })} className="min-w-0 flex-1 truncate text-left text-sm">
                                          {c.label_en}
                                          <span className="text-muted-foreground ml-2 text-xs">{c.link_type}{c.link_target ? `: ${c.link_target}` : ""}</span>
                                        </button>
                                        <button type="button" title="Delete" onClick={() => removeNode(c.id, n.id)} className="hover:text-danger hover:bg-accent rounded p-1">
                                          <Trash2 className="size-3.5" />
                                        </button>
                                      </div>
                                    )}
                                  </SortableItem>
                                </li>
                              ))}
                            </ul>
                          </SortableList>
                        )}
                      </div>
                    )}
                  </SortableItem>
                </li>
              ))}
            </ul>
          </SortableList>
          {menu.tree.length === 0 && <p className="text-muted-foreground text-sm">No items. The storefront falls back to the category list for this menu.</p>}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">Pick a menu.</p>
      )}

      <Sheet open={Boolean(editingNode)} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
          {editingNode && editing && (
            <>
              <SheetHeader>
                <SheetTitle>{editingNode.label_en}</SheetTitle>
                <SheetDescription>{editing.parentId ? "Sub link" : "Top-level item. Enable the mega menu to build a panel with columns and a featured image."}</SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
                <SchemaForm key={editingNode.id} idPrefix={editingNode.id.slice(0, 6)} fields={editing.parentId ? childFields : topFields} values={editingNode as unknown as Record<string, unknown>} onChange={(v) => updateNode(editing.id, editing.parentId, v as Partial<NavTreeNode>)} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <span className="hidden">
        <Input />
      </span>
    </div>
  );
}
