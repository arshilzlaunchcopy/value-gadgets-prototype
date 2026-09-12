import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { CouponEditor, type CouponEditorData } from "./coupon-editor";

export const dynamic = "force-dynamic";

export default async function CouponPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "new";
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const admin = createAdminClient();
  const [{ data: c }, { data: categories }, { data: products }] = await Promise.all([
    isNew ? Promise.resolve({ data: null }) : admin.from("coupons").select("*").eq("id", id).maybeSingle(),
    admin.from("categories").select("id, name_en").eq("is_active", true).order("position"),
    admin.from("products").select("id, title_en, product_variants(price_bdt)").eq("status", "active").order("title_en").limit(300),
  ]);
  if (!isNew && !c) notFound();
  const applies = (c?.applies_to ?? { all: true }) as { all?: boolean; category_ids?: string[]; product_ids?: string[] };
  const data: CouponEditorData = {
    coupon: c
      ? { id: c.id, code: c.code, description: c.description ?? "", type: c.type as "percentage" | "fixed" | "free_shipping", value: c.value, min_order_bdt: c.min_order_bdt, max_discount_bdt: c.max_discount_bdt, usage_limit: c.usage_limit, usage_limit_per_customer: c.usage_limit_per_customer, applies_all: applies.all !== false, category_ids: applies.category_ids ?? [], product_ids: applies.product_ids ?? [], starts_at: c.starts_at ? c.starts_at.slice(0, 16) : "", ends_at: c.ends_at ? c.ends_at.slice(0, 16) : "", is_active: c.is_active }
      : null,
    categories: (categories ?? []).map((x) => ({ id: x.id, label: x.name_en })),
    products: (products ?? []).map((p) => ({ id: p.id, label: p.title_en, price_bdt: Math.min(...((p.product_variants ?? []).map((v) => v.price_bdt).length ? (p.product_variants ?? []).map((v) => v.price_bdt) : [0])) })),
    timesUsed: c?.times_used ?? 0,
  };
  return (
    <>
      <PageHeader title={c ? c.code : "New coupon"} description={c ? `Used ${c.times_used} time(s)` : "Percentage, fixed amount or free delivery; scoped to everything, categories or products."} />
      <CouponEditor data={data} />
    </>
  );
}
