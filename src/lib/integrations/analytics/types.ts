/**
 * Server-side conversion tracking adapter (BUILD_PROMPT §7.8): Meta Conversions
 * API (and GA4 Measurement Protocol later) called from the order path, deduped
 * against the browser pixel by event_id. Only adapters talk to the network.
 */
export interface PurchaseEvent {
  /** shared with the browser pixel: the order id */
  eventId: string;
  orderId: string;
  orderNumber: string;
  valueBdt: number;
  currency: "BDT";
  contents: { id: string; quantity: number; price_bdt: number }[];
  customer: { phone: string; email?: string | null; ip?: string | null; userAgent?: string | null };
  sourceUrl: string;
}

export interface AnalyticsResult {
  ok: boolean;
  provider: string;
  skipped?: boolean;
  error?: string;
  raw?: unknown;
}

export interface AnalyticsAdapter {
  readonly name: string;
  readonly isMock: boolean;
  purchase(e: PurchaseEvent): Promise<AnalyticsResult>;
}
