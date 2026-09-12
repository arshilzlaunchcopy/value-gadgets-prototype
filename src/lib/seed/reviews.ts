import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_REPLIES, REVIEW_TEXT } from "./data/people";
import { Rng, SEED } from "./rng";

export const REVIEW_COUNT = 50;

/**
 * 50 approved reviews on delivered orders. Rating curve: heavy 5s, some 4s,
 * a few 2s (BUILD_PROMPT_PART3 §21.2). Deterministic ids -> idempotent upsert.
 */
export async function seedReviews(count = REVIEW_COUNT): Promise<number> {
  const admin = createAdminClient();
  const rng = new Rng(SEED ^ 0x2e51);

  const { data: delivered, error } = await admin
    .from("orders")
    .select("id, customer_id, customer_name, delivered_at, order_items(product_id)")
    .eq("status", "delivered")
    .order("placed_at", { ascending: true })
    .limit(400);
  if (error) throw new Error(`seed reviews: ${error.message}`);
  if (!delivered?.length) return 0;

  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (rows.length < count && guard++ < count * 10) {
    const o = rng.pick(delivered);
    const items = (o.order_items ?? []) as { product_id: string | null }[];
    const pid = rng.pick(items)?.product_id;
    if (!pid || !o.customer_id) continue;
    const key = `${o.customer_id}:${pid}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const rating = rng.weighted([[5, 55], [4, 28], [3, 9], [2, 5], [1, 3]] as const);
    const text = REVIEW_TEXT[rating];
    const createdAt = new Date(new Date(o.delivered_at ?? Date.now()).getTime() + rng.int(1, 9) * 86_400_000);
    const replied = rng.chance(rating <= 3 ? 0.7 : 0.2);
    rows.push({
      id: rng.uuid(),
      product_id: pid,
      customer_id: o.customer_id,
      order_id: o.id,
      rating,
      title: rng.pick(text.titles),
      body: rng.pick(text.bodies),
      reviewer_name: o.customer_name,
      is_verified_purchase: true,
      status: "approved",
      admin_reply: replied ? rng.pick(ADMIN_REPLIES) : null,
      replied_at: replied ? new Date(createdAt.getTime() + rng.int(2, 48) * 3_600_000).toISOString() : null,
      created_at: createdAt.toISOString(),
    });
  }

  const { error: upErr } = await admin.from("reviews").upsert(rows as never, { onConflict: "id" });
  if (upErr) throw new Error(`seed reviews upsert: ${upErr.message}`);
  console.log(`[seed] reviews: ${rows.length}`);
  return rows.length;
}
