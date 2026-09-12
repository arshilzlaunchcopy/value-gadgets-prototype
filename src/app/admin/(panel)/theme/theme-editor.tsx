"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SchemaForm } from "@/components/admin/schema-form";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FieldSpec } from "@/lib/blocks/fields";
import type { ThemeKey } from "@/lib/theme/schema";
import { saveThemeAction } from "./actions";

interface Section {
  key: ThemeKey;
  label: string;
  description: string;
  fields: FieldSpec[];
  values: Record<string, unknown>;
}

export function ThemeEditor({ sections }: { sections: Section[] }) {
  const [values, setValues] = useState<Record<ThemeKey, Record<string, unknown>>>(() => Object.fromEntries(sections.map((s) => [s.key, s.values])) as Record<ThemeKey, Record<string, unknown>>);
  const [dirty, setDirty] = useState<Partial<Record<ThemeKey, boolean>>>({});
  const [pending, start] = useTransition();

  const save = (key: ThemeKey) =>
    start(async () => {
      const r = await saveThemeAction(key, values[key]);
      if (r.ok) {
        toast.success("Saved and published");
        setDirty((d) => ({ ...d, [key]: false }));
      } else toast.error(r.error ?? "Could not save");
    });

  return (
    <Tabs defaultValue={sections[0]?.key}>
      <TabsList className="mb-4 flex-wrap">
        {sections.map((s) => (
          <TabsTrigger key={s.key} value={s.key}>
            {s.label}
            {dirty[s.key] && <span className="bg-amber ml-1 size-1.5 rounded-full" aria-label="unsaved" />}
          </TabsTrigger>
        ))}
      </TabsList>
      {sections.map((s) => (
        <TabsContent key={s.key} value={s.key}>
          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            <div className="bg-paper rounded-2xl border p-4 sm:p-6">
              <SchemaForm
                idPrefix={s.key}
                fields={s.fields}
                values={s.values}
                onChange={(v) => {
                  setValues((prev) => ({ ...prev, [s.key]: v }));
                  setDirty((d) => ({ ...d, [s.key]: true }));
                }}
              />
            </div>
            <aside className="bg-paper h-fit space-y-3 rounded-2xl border p-4">
              <p className="text-sm font-semibold">{s.label}</p>
              <p className="text-muted-foreground text-xs">{s.description}</p>
              <Button className="w-full rounded-lg" disabled={pending || !dirty[s.key]} onClick={() => save(s.key)}>
                {pending ? "Saving…" : "Save & publish"}
              </Button>
              <Link href="/" target="_blank" className="text-muted-foreground block text-center text-xs underline">
                Open storefront
              </Link>
            </aside>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
