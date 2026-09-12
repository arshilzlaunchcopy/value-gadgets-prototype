import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProductsTable, type ProductRow } from "./products-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim();
  const status = typeof sp.status === "string" ? sp.status : "";
  const admin = createAdminClient();
  let qb = admin.from("products").select("id, title_en, slug, status, is_featured, updated_at, brands(name), product_variants(id, sku, price_bdt, stock_qty, low_stock_threshold, option_value), product_images(url, position), product_categories(categories(name_en))").order("updated_at", { ascending: false }).limit(300);
  if (q) qb = qb.ilike("title_en", `%${q}%`);
  if (status) qb = qb.eq("status", status);
  const { data } = await qb;
  const rows: ProductRow[] = (data ?? []).map((p) => {
    const variants = p.product_variants ?? [];
    const img = [...(p.product_images ?? [])].sort((a, b) => a.position - b.position)[0];
    return {
      id: p.id,
      title_en: p.title_en,
      slug: p.slug,
      status: p.status,
      is_featured: p.is_featured,
      brand: (p.brands as { name: string } | null)?.name ?? null,
      image: img?.url ?? null,
      categories: (p.product_categories ?? []).map((c) => (c.categories as { name_en: string } | null)?.name_en ?? "").filter(Boolean),
      variant_count: variants.length,
      single_variant_id: variants.length === 1 ? variants[0].id : null,
      min_price: variants.length ? Math.min(...variants.map((v) => v.price_bdt)) : 0,
      stock: variants.reduce((n, v) => n + v.stock_qty, 0),
      low: variants.some((v) => v.stock_qty <= v.low_stock_threshold),
      updated_at: p.updated_at,
    };
  });
  return (
    <>
      <PageHeader
        title="Products"
        description={`${rows.length} shown`}
        actions={
          <Button asChild className="rounded-lg">
            <Link href="/admin/products/new">New product</Link>
          </Button>
        }
      />
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search title" className="bg-paper rounded-lg border px-3 py-2 text-sm" aria-label="Search" />
        <select name="status" defaultValue={status} className="bg-paper rounded-lg border px-3 py-2 text-sm" aria-label="Status">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <button type="submit" className="bg-ink text-paper rounded-lg px-4 py-2 text-sm">Filter</button>
      </form>
      <ProductsTable rows={rows} />
    </>
  );
}
