export interface DispatchPayload {
  /** Your order_number - Steadfast calls it invoice */
  invoice: string;
  recipientName: string;
  /** Local 11-digit form, e.g. 01712345678 */
  recipientPhone: string;
  recipientAddress: string;
  /** 0 for prepaid orders. Never send the full amount on a paid order. */
  codAmountBdt: number;
  note?: string;
}

export interface DispatchResult {
  consignmentId: string;
  trackingCode: string;
  status: string;
  raw?: unknown;
}

export interface BulkResult {
  results: Array<{ invoice: string; ok: boolean; consignmentId?: string; trackingCode?: string; error?: string }>;
  raw?: unknown;
}

export type NormalizedCourierStatus =
  | "created"
  | "picked"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "partial_delivered"
  | "returned"
  | "cancelled"
  | "lost"
  | "on_hold";

export interface CourierStatus {
  /** Courier's raw status string, e.g. "delivered", "partial_delivered", "cancelled" */
  rawStatus: string;
  normalized: NormalizedCourierStatus;
  consignmentId?: string;
  trackingCode?: string;
  updatedAt?: string;
  raw?: unknown;
}

export interface ReturnRequest {
  consignmentId: string;
  invoice: string;
  reason?: string;
}

export interface ReturnResult {
  ok: boolean;
  returnRef?: string;
  raw?: unknown;
  error?: string;
}

/**
 * CourierAdapter (BUILD_PROMPT_PART2 §14.2 / PART3 §20.3).
 * Adapters only talk to the courier. Writing shipments rows, order_events and
 * order status lives in src/lib/orders/dispatch.ts, shared by mock and real.
 */
export interface CourierAdapter {
  readonly name: string;
  readonly code: string;
  readonly isMock: boolean;
  createOrder(p: DispatchPayload): Promise<DispatchResult>;
  createBulkOrders(p: DispatchPayload[]): Promise<BulkResult>;
  statusByInvoice(invoice: string): Promise<CourierStatus>;
  statusByConsignmentId(id: string): Promise<CourierStatus>;
  statusByTrackingCode(code: string): Promise<CourierStatus>;
  getBalance(): Promise<number>;
  createReturnRequest(r: ReturnRequest): Promise<ReturnResult>;
}
