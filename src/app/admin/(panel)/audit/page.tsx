import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { formatDateTime } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit log" };

type SP = Record<string, string | string[] | undefined>;
const one = (sp: SP, k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) ?? "";
const PAGE = 100;

/** Audit log viewer (BUILD_PROMPT §4.8, §6.2): who did what, with before/after. */
export default async function AuditPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const actor = one(sp, "actor").trim();
  const action = one(sp, "action").trim();
  const page = Math.max(1, Number(one(sp, "page")) || 1);
  let q = createAdminClient().from("audit_log").select("id, actor_email, action, entity_type, entity_id, before, after, ip, created_at", { count: "exact" }).order("created_at", { ascending: false });
  if (actor) q = q.ilike("actor_email", `%${actor}%`);
  if (action) q = q.ilike("action", `${action}%`);
  const from = (page - 1) * PAGE;
  const { data, count } = await q.range(from, from + PAGE - 1);
  const total = count ?? 0;
  const qs = (p: number) => `/admin/audit?${new URLSearchParams({ ...(actor ? { actor } : {}), ...(action ? { action } : {}), page: String(p) }).toString()}`;

  return (
    <>
      <PageHeader title="Audit log" description={`${total} entr${total === 1 ? "y" : "ies"}. Settings, products, orders, staff, content and fraud changes are recorded with before/after snapshots.`} />
      <form method="get" className="bg-paper mb-4 flex flex-wrap gap-2 rounded-2xl border p-3">
        <input name="actor" defaultValue={actor} placeholder="Actor email" className="bg-paper rounded-lg border px-3 py-2 text-sm" aria-label="Actor" />
        <input name="action" defaultValue={action} placeholder="Action prefix, e.g. order." className="bg-paper rounded-lg border px-3 py-2 text-sm" aria-label="Action" />
        <button type="submit" className="bg-ink text-paper rounded-lg px-4 py-2 text-sm">Filter</button>
        <Link href="/admin/audit" className="rounded-lg border px-4 py-2 text-sm">Clear</Link>
      </form>
      <div className="bg-paper overflow-x-auto rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-paper-soft text-left text-xs uppercase"><tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Actor</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Entity</th><th className="px-3 py-2">Change</th></tr></thead>
          <tbody>
            {(data ?? []).map((e) => (
              <tr key={e.id} className="border-t align-top">
                <td className="px-3 py-2 text-xs whitespace-nowrap">{formatDateTime(e.created_at)}</td>
                <td className="px-3 py-2 text-xs">{e.actor_email ?? "system"}{e.ip ? <span className="text-muted-foreground block">{String(e.ip)}</span> : null}</td>
                <td className="px-3 py-2 font-mono text-xs">{e.action}</td>
                <td className="px-3 py-2 text-xs">{e.entity_type}{e.entity_id ? <span className="text-muted-foreground block font-mono">{e.entity_id.slice(0, 8)}</span> : null}</td>
                <td className="px-3 py-2">
                  {(e.before || e.after) && (
                    <details className="text-xs">
                      <summary className="cursor-pointer">before / after</summary>
                      <pre className="bg-paper-soft mt-1 max-h-48 max-w-xl overflow-auto rounded-lg p-2 text-[11px]">{JSON.stringify({ before: e.before, after: e.after }, null, 1)}</pre>
                    </details>
                  )}
                </td>
              </tr>
            ))}
            {(data ?? []).length === 0 && <tr><td colSpan={5} className="text-muted-foreground px-3 py-8 text-center">No entries.</td></tr>}
          </tbody>
        </table>
      </div>
      <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
        <span className="text-muted-foreground">Page {page} of {Math.max(1, Math.ceil(total / PAGE))}</span>
        <div className="flex gap-2">
          {page > 1 && <Link href={qs(page - 1)} className="rounded-lg border px-3 py-1.5">Previous</Link>}
          {from + PAGE < total && <Link href={qs(page + 1)} className="rounded-lg border px-3 py-1.5">Next</Link>}
        </div>
      </nav>
    </>
  );
}
