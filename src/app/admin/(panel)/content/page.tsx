import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Content" };

/** Pages and blog posts (BUILD_PROMPT §6.2 Content). Media library is its own section. */
export default async function ContentPage() {
  const admin = createAdminClient();
  const [{ data: pages }, { data: posts }] = await Promise.all([
    admin.from("pages").select("id, slug, title_en, title_bn, is_published, show_in_footer, position, updated_at").order("position"),
    admin.from("posts").select("id, slug, title_en, status, published_at, updated_at, author_name").order("updated_at", { ascending: false }),
  ]);
  return (
    <>
      <PageHeader title="Content" description="Static pages (terms, privacy, about...) in English and Bangla, and the SEO blog. Markdown with live preview." />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="bg-paper rounded-2xl border">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-semibold">Pages ({pages?.length ?? 0})</h2>
            <Button asChild size="sm" className="rounded-lg"><Link href="/admin/content/pages/new">New page</Link></Button>
          </div>
          <ul className="divide-y text-sm">
            {(pages ?? []).map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2">
                <span className="min-w-0 flex-1">
                  <Link href={`/admin/content/pages/${p.id}`} className="font-medium hover:underline">{p.title_en}</Link>
                  <span className="text-muted-foreground block text-xs">/pages/{p.slug}{p.title_bn ? " · বাংলা" : " · no Bangla"}{p.show_in_footer ? " · footer" : ""}{p.is_published ? "" : " · draft"}</span>
                </span>
                <span className="text-muted-foreground text-xs">{formatDate(p.updated_at)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="bg-paper rounded-2xl border">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-semibold">Blog posts ({posts?.length ?? 0})</h2>
            <Button asChild size="sm" className="rounded-lg"><Link href="/admin/content/posts/new">New post</Link></Button>
          </div>
          <ul className="divide-y text-sm">
            {(posts ?? []).map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2">
                <span className="min-w-0 flex-1">
                  <Link href={`/admin/content/posts/${p.id}`} className="font-medium hover:underline">{p.title_en}</Link>
                  <span className="text-muted-foreground block text-xs">/blog/{p.slug} · {p.author_name ?? "—"}</span>
                </span>
                <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${p.status === "published" ? "bg-success/15 text-success-deep" : "bg-muted"}`}>{p.status}</span>
                <span className="text-muted-foreground text-xs">{formatDate(p.published_at ?? p.updated_at)}</span>
              </li>
            ))}
            {(posts ?? []).length === 0 && <li className="text-muted-foreground px-4 py-6 text-center text-xs">No posts yet.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
