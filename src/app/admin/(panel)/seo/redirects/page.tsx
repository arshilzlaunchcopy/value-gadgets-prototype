import { PageHeader } from "@/components/admin/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { RedirectsManager } from "./redirects-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Redirects" };

export default async function RedirectsPage() {
  const { data } = await createAdminClient().from("redirects").select("id, from_path, to_path, status_code, hit_count, last_hit_at, is_active, created_at").order("hit_count", { ascending: false }).order("created_at", { ascending: false }).limit(1000);
  return (
    <>
      <PageHeader title="Redirect manager" description="Slug changes create 301s automatically. Add manual rules here, import a CSV, and watch hit counts to see which ones matter (BUILD_PROMPT §7.6)." />
      <RedirectsManager rows={(data ?? []).map((r) => ({ ...r, status_code: r.status_code as 301 | 302 | 410 }))} />
    </>
  );
}
