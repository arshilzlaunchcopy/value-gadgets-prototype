import "server-only";

import { KNOWN_PHONES, type KnownPhone } from "@/lib/demo/known-phones";
import { getDemoSettings, type DemoSettings } from "@/lib/demo/settings";
import { getAdapterStatus, type AdapterStatus } from "@/lib/integrations";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PanelOrder {
  id: string;
  order_number: string;
  status: string;
  payment_method: string;
  payment_status: string;
  total_bdt: number;
  customer_phone: string;
  customer_name: string | null;
  fraud_score: number | null;
  needs_review: boolean;
  placed_at: string;
  shipment: { normalized_status: string; tracking_code: string | null } | null;
}

export interface PanelSms {
  id: string;
  to_phone: string;
  message: string;
  kind: string;
  status: string;
  sent_at: string;
}

export interface PanelData {
  adapters: AdapterStatus[];
  settings: DemoSettings;
  orders: PanelOrder[];
  smsLog: PanelSms[];
  knownPhones: KnownPhone[];
  counts: Record<string, number>;
  siteUrl: string;
}

export async function loadPanelData(): Promise<PanelData> {
  const admin = createAdminClient();
  const [settings, ordersRes, smsRes, countsRes] = await Promise.all([
    getDemoSettings(),
    admin
      .from("orders")
      .select(
        "id, order_number, status, payment_method, payment_status, total_bdt, customer_phone, customer_name, fraud_score, needs_review, placed_at, shipments(normalized_status, tracking_code, created_at)",
      )
      .order("placed_at", { ascending: false })
      .limit(40),
    admin.from("demo_sms_log").select("id, to_phone, message, kind, status, sent_at").order("sent_at", { ascending: false }).limit(15),
    admin.rpc("demo_counts"),
  ]);

  const orders: PanelOrder[] = (ordersRes.data ?? []).map((o) => {
    const ships = (o.shipments ?? []) as { normalized_status: string; tracking_code: string | null; created_at: string }[];
    const latest = [...ships].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0] ?? null;
    return {
      id: o.id,
      order_number: o.order_number,
      status: o.status,
      payment_method: o.payment_method,
      payment_status: o.payment_status,
      total_bdt: o.total_bdt,
      customer_phone: o.customer_phone,
      customer_name: o.customer_name,
      fraud_score: o.fraud_score,
      needs_review: o.needs_review,
      placed_at: o.placed_at,
      shipment: latest ? { normalized_status: latest.normalized_status, tracking_code: latest.tracking_code } : null,
    };
  });

  return {
    adapters: getAdapterStatus(),
    settings,
    orders,
    smsLog: (smsRes.data ?? []) as PanelSms[],
    knownPhones: KNOWN_PHONES,
    counts: (countsRes.data as Record<string, number> | null) ?? {},
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  };
}
