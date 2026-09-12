import { PageHeader } from "@/components/admin/page-header";
import { normalizeBD } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReviewQueue, type ReviewItem } from "./review-queue";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review queue" };

/**
 * Review Queue (BUILD_PROMPT §6.2): fraud-flagged orders with the customer's
 * full history inline, approve or cancel with one click.
 */
export default async function ReviewQueuePage() {
  const admin = createAdminClient();
  const { data: orders } = await admin
    .from("orders")
    .select("id, order_number, placed_at, status, payment_method, payment_status, total_bdt, customer_id, customer_name, customer_phone, customer_email, fraud_score, fraud_flags, otp_reverify_required, shipping_address, ip, order_items(product_title, quantity, line_total_bdt)")
    .eq("needs_review", true)
    .not("status", "in", "(cancelled,delivered,returned,refunded)")
    .order("fraud_score", { ascending: false })
    .order("placed_at", { ascending: true })
    .limit(100);

  const phones = [...new Set((orders ?? []).map((o) => o.customer_phone))];
  const customerIds = [...new Set((orders ?? []).map((o) => o.customer_id).filter((x): x is string => Boolean(x)))];
  const [{ data: history }, { data: customers }, { data: scores }] = await Promise.all([
    phones.length ? admin.from("orders").select("id, order_number, customer_phone, status, payment_method, total_bdt, placed_at").in("customer_phone", phones).order("placed_at", { ascending: false }).limit(400) : Promise.resolve({ data: [] as never[] }),
    customerIds.length ? admin.from("customers").select("id, full_name, total_orders, total_delivered, total_cancelled, total_returned, is_blocked, notes, created_at").in("id", customerIds) : Promise.resolve({ data: [] as never[] }),
    phones.length ? admin.from("courier_score_cache").select("phone, total_parcels, total_delivered, total_cancelled, success_ratio, fraud_report_count").in("phone", phones.map((p) => normalizeBD(p) ?? p)) : Promise.resolve({ data: [] as never[] }),
  ]);
  const custById = new Map((customers ?? []).map((c) => [c.id, c]));
  const scoreByPhone = new Map((scores ?? []).map((s) => [s.phone, s]));

  const items: ReviewItem[] = (orders ?? []).map((o) => {
    const c = o.customer_id ? custById.get(o.customer_id) : undefined;
    const addr = (o.shipping_address ?? {}) as Record<string, string>;
    const cs = scoreByPhone.get(normalizeBD(o.customer_phone) ?? o.customer_phone);
    return {
      id: o.id,
      order_number: o.order_number,
      placed_at: o.placed_at,
      status: o.status,
      payment_method: o.payment_method,
      total_bdt: o.total_bdt,
      customer_name: o.customer_name ?? c?.full_name ?? null,
      customer_phone: o.customer_phone,
      fraud_score: o.fraud_score ?? 0,
      fraud_flags: Array.isArray(o.fraud_flags) ? (o.fraud_flags as string[]) : [],
      otp_reverify_required: o.otp_reverify_required,
      address: [addr.street_address, addr.area, addr.upazila, addr.district].filter(Boolean).join(", "),
      district: addr.district ?? "",
      ip: (o.ip as string | null) ?? null,
      items: (o.order_items ?? []).map((i) => ({ title: i.product_title, qty: i.quantity, total: i.line_total_bdt })),
      customer: c ? { since: c.created_at, orders: c.total_orders, delivered: c.total_delivered, cancelled: c.total_cancelled, returned: c.total_returned, blocked: c.is_blocked, notes: c.notes } : null,
      courier: cs ? { parcels: cs.total_parcels, delivered: cs.total_delivered, cancelled: cs.total_cancelled, ratio: cs.success_ratio === null ? null : Number(cs.success_ratio), fraud_reports: cs.fraud_report_count } : null,
      history: (history ?? []).filter((h) => h.customer_phone === o.customer_phone && h.id !== o.id).slice(0, 8).map((h) => ({ id: h.id, order_number: h.order_number, status: h.status, payment_method: h.payment_method, total_bdt: h.total_bdt, placed_at: h.placed_at })),
    };
  });

  return (
    <>
      <PageHeader title="Review queue" description={`${items.length} order${items.length === 1 ? "" : "s"} waiting. Highest fraud score first. Approve confirms the order; cancel records a fraud cancellation.`} />
      <ReviewQueue items={items} />
    </>
  );
}
