import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { LandingEditor, type LandingEditorData } from "./landing-editor";

export const dynamic = "force-dynamic";

export default async function LandingEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  const isNew = id === "new";
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ data: lp }, { data: products }, { data: blocksA }, { data: blocksB }] = await Promise.all([
    isNew ? Promise.resolve({ data: null }) : admin.from("landing_pages").select("*").eq("id", id).maybeSingle(),
    admin.from("products").select("id, title_en").eq("status", "active").order("title_en").limit(500),
    isNew ? Promise.resolve({ data: [] }) : admin.from("content_blocks").select("id").eq("page_type", "landing").eq("target_id", id),
    isNew ? Promise.resolve({ data: [] }) : admin.from("content_blocks").select("id, target_id").eq("page_type", "landing").eq("scope", "instance"),
  ]);
  if (!isNew && !lp) notFound();
  const data: LandingEditorData = {
    page: lp
      ? { id: lp.id, slug: lp.slug, title: lp.title, product_id: lp.product_id, status: lp.status as "draft" | "published", chrome: lp.chrome as "none" | "minimal", otp_mode: lp.otp_mode as "never" | "always" | "above_threshold", otp_threshold_bdt: lp.otp_threshold_bdt, pixel_event: lp.pixel_event ?? "", ab_enabled: lp.ab_enabled, meta_title: lp.meta_title ?? "", meta_description: lp.meta_description ?? "", og_image_url: lp.og_image_url ?? "", variant_b_id: lp.variant_b_id, views_a: lp.views_a, views_b: lp.views_b }
      : null,
    products: (products ?? []).map((p) => ({ id: p.id, label: p.title_en })),
    blocksA: blocksA?.length ?? 0,
    blocksB: lp ? (blocksB ?? []).filter((b) => b.target_id === lp.variant_b_id).length : 0,
  };
  return (
    <>
      <PageHeader title={lp ? lp.title : "New landing page"} description={lp ? `/lp/${lp.slug}` : "Create the page, then design each variant in the page builder."} />
      <LandingEditor data={data} />
    </>
  );
}
