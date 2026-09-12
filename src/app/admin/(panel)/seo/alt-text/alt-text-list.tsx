"use client";

/* eslint-disable @next/next/no-img-element -- product thumbnails */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AltTextIssue } from "@/lib/seo/audit";
import { setAltTextAction } from "../actions";

export function AltTextList({ issues }: { issues: AltTextIssue[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  if (issues.length === 0) return <p className="bg-paper text-success-deep rounded-2xl border p-8 text-center text-sm">Every product image has a useful alt text.</p>;
  return (
    <ul className="bg-paper divide-y rounded-2xl border">
      {issues.map((i) => (
        <li key={i.image_id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
          <img src={i.url} alt="" className="size-12 rounded-lg object-cover" loading="lazy" />
          <span className="min-w-0 flex-1">
            <Link href={`/admin/products/${i.product_id}`} className="block truncate font-medium hover:underline">{i.product_title}</Link>
            <span className="text-danger text-xs">{i.problem}{i.alt_text_en ? `: "${i.alt_text_en}"` : ""}</span>
          </span>
          <Input value={drafts[i.image_id] ?? i.alt_text_en} onChange={(e) => setDrafts({ ...drafts, [i.image_id]: e.target.value })} placeholder={`${i.product_title}, front view`} className="w-72 rounded-lg" aria-label={`Alt text for ${i.product_title}`} />
          <Button size="sm" className="rounded-lg" disabled={pending || (drafts[i.image_id] ?? "").trim().length < 3} onClick={() => start(async () => { const r = await setAltTextAction(i.image_id, drafts[i.image_id] ?? ""); if (r.ok) { toast.success("Saved"); router.refresh(); } else toast.error(r.error ?? "Failed"); })}>
            Save
          </Button>
        </li>
      ))}
    </ul>
  );
}
