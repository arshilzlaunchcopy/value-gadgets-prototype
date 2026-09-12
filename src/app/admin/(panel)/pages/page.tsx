import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { PAGE_TYPES } from "@/lib/blocks/define";
import { createAdminClient } from "@/lib/supabase/admin";
import { InstancePicker } from "./instance-picker";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pages" };

const LABELS: Record<string, string> = { home: "Home page", product: "Product page (template)", category: "Category page (template)", collection: "Collection page (template)", page: "Static pages (template)", landing: "Landing pages (template)", custom: "Custom pages" };

export default async function PagesIndex() {
  const admin = createAdminClient();
  const [{ data: live }, { data: drafts }, { data: instances }] = await Promise.all([
    admin.from("content_blocks").select("page_type, target_id").eq("scope", "template"),
    admin.from("content_drafts").select("page_type, target_id, updated_at"),
    admin.from("content_blocks").select("page_type, target_id").eq("scope", "instance"),
  ]);
  const liveCount = new Map<string, number>();
  for (const r of live ?? []) liveCount.set(r.page_type, (liveCount.get(r.page_type) ?? 0) + 1);
  const draftAt = new Map((drafts ?? []).filter((d) => !d.target_id).map((d) => [d.page_type, d.updated_at]));
  const instanceCount = new Map<string, Set<string>>();
  for (const r of instances ?? []) {
    if (!r.target_id) continue;
    if (!instanceCount.has(r.page_type)) instanceCount.set(r.page_type, new Set());
    instanceCount.get(r.page_type)!.add(r.target_id);
  }

  return (
    <>
      <PageHeader title="Pages" description="Templates apply to every page of a type; an instance override replaces the template for one product, category or collection." />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PAGE_TYPES.map((t) => (
          <li key={t} className="bg-paper rounded-2xl border p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">{LABELS[t] ?? t}</h2>
                <p className="text-muted-foreground text-xs">
                  {liveCount.get(t) ?? 0} published block{(liveCount.get(t) ?? 0) === 1 ? "" : "s"}
                  {draftAt.get(t) && <span className="text-warn-deep"> · unpublished draft</span>}
                  {instanceCount.get(t)?.size ? ` · ${instanceCount.get(t)!.size} instance override${instanceCount.get(t)!.size === 1 ? "" : "s"}` : ""}
                </p>
              </div>
              <Button asChild size="sm" className="rounded-lg">
                <Link href={`/admin/pages/${t}`}>Edit</Link>
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <section className="bg-paper mt-6 rounded-2xl border p-4">
        <h2 className="font-semibold">Instance override</h2>
        <p className="text-muted-foreground mb-3 text-sm">Give one product, category, collection or landing page variant its own block layout. Landing pages are created under <Link href="/admin/landing" className="underline">Landing pages</Link>.</p>
        <InstancePicker />
      </section>
    </>
  );
}
