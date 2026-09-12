import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { EMPTY_CART, type CartLine, type CartSummary } from "./types";

/** Live availability for variants, net of OTHER carts' active reservations. */
export async function availabilityFor(variantIds: string[], excludeCartId: string | null): Promise<Map<string, number>> {
  const admin = createAdminClient();
  if (variantIds.length === 0) return new Map();
  const [{ data: variants }, { data: reservations }] = await Promise.all([
    admin.from("product_variants").select("id, stock_qty").in("id", variantIds),
    admin.from("stock_reservations").select("variant_id, quantity, cart_id").in("variant_id", variantIds).gt("expires_at", new Date().toISOString()),
  ]);
  const reserved = new Map<string, number>();
  for (const r of reservations ?? []) {
    if (excludeCartId && r.cart_id === excludeCartId) continue;
    reserved.set(r.variant_id, (reserved.get(r.variant_id) ?? 0) + r.quantity);
  }
  const out = new Map<string, number>();
  for (const v of variants ?? []) out.set(v.id, Math.max(0, v.stock_qty - (reserved.get(v.id) ?? 0)));
  return out;
}

/** Full cart with display data for the drawer and cart page. Prices come from the DB, never the client. */
export async function getCartSummary(cartId: string | null): Promise<CartSummary> {
  if (!cartId) return EMPTY_CART;
  const admin = createAdminClient();
  const [{ data: cart }, { data: items }] = await Promise.all([
    admin.from("carts").select("id, coupon_code").eq("id", cartId).maybeSingle(),
    admin
      .from("cart_items")
      .select(
        "id, quantity, variant_id, product_variants(id, sku, price_bdt, compare_at_price_bdt, option_name, option_value, product_id, products(id, slug, title_en, status, product_images(url, position)))",
      )
      .eq("cart_id", cartId)
      .order("created_at"),
  ]);
  if (!cart) return EMPTY_CART;

  const rows = (items ?? []).filter((i) => i.product_variants && (i.product_variants.products as { status: string } | null)?.status === "active");
  const availability = await availabilityFor(
    rows.map((r) => r.variant_id),
    cartId,
  );

  const lines: CartLine[] = rows.map((r) => {
    const v = r.product_variants!;
    const p = v.products as { id: string; slug: string; title_en: string; product_images: { url: string; position: number }[] };
    const img = [...(p.product_images ?? [])].sort((a, b) => a.position - b.position)[0];
    return {
      id: r.id,
      variant_id: v.id,
      product_id: p.id,
      slug: p.slug,
      title: p.title_en,
      variant_label: v.option_value ? `${v.option_name ?? "Option"}: ${v.option_value}` : null,
      sku: v.sku,
      unit_price_bdt: v.price_bdt,
      compare_at_bdt: v.compare_at_price_bdt,
      quantity: r.quantity,
      line_total_bdt: v.price_bdt * r.quantity,
      available_qty: availability.get(v.id) ?? 0,
      image: img ? { src: img.url, alt: p.title_en } : null,
    };
  });

  return {
    id: cart.id,
    items: lines,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal_bdt: lines.reduce((n, l) => n + l.line_total_bdt, 0),
    coupon_code: cart.coupon_code,
  };
}
