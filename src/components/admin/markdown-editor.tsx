"use client";

import Markdown from "react-markdown";
import { Textarea } from "@/components/ui/textarea";

/** Markdown textarea with a live preview beside it (BUILD_PROMPT §6.2 Content). */
export function MarkdownEditor({ value, onChange, lang, rows = 18, placeholder }: { value: string; onChange: (v: string) => void; lang?: "en" | "bn"; rows?: number; placeholder?: string }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} lang={lang} placeholder={placeholder} className="rounded-lg font-mono text-xs leading-relaxed" />
      <div lang={lang} className="prose prose-neutral bg-paper-soft max-w-none overflow-y-auto rounded-lg border p-4 text-sm leading-relaxed [&_a]:underline [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_p]:my-2" style={{ maxHeight: `${rows * 1.7}rem` }}>
        {value ? <Markdown>{value}</Markdown> : <p className="text-muted-foreground">Preview</p>}
      </div>
    </div>
  );
}
