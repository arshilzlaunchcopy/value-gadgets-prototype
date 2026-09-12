import "server-only";

import type {
  BulkResult,
  CourierAdapter,
  CourierStatus,
  DispatchPayload,
  DispatchResult,
  ReturnRequest,
  ReturnResult,
} from "./types";

export interface SteadfastConfig {
  apiKey: string;
  secretKey: string;
  baseUrl?: string; // default https://portal.packzy.com/api/v1
}

/**
 * Real Steadfast adapter (BUILD_PROMPT_PART2 §14.2). Signatures are final.
 * Bodies land at go-live: 3x exponential backoff on 5xx/network only,
 * 15 s timeout / 8 s connect, every call logged to courier_api_log,
 * phone normalised to 11 digits, bulk chunked at 500.
 */
export class SteadfastAdapter implements CourierAdapter {
  readonly name = "Steadfast";
  readonly code = "steadfast";
  readonly isMock = false;
  private readonly baseUrl: string;

  constructor(private readonly cfg: SteadfastConfig) {
    this.baseUrl = cfg.baseUrl ?? "https://portal.packzy.com/api/v1";
  }

  /** POST /create_order */
  async createOrder(_p: DispatchPayload): Promise<DispatchResult> {
    void this.cfg;
    void this.baseUrl;
    throw new Error("SteadfastAdapter.createOrder not implemented");
  }

  /** POST /create_order/bulk-order (chunk at 500) */
  async createBulkOrders(_p: DispatchPayload[]): Promise<BulkResult> {
    throw new Error("SteadfastAdapter.createBulkOrders not implemented");
  }

  /** GET /status_by_invoice/{invoice} - preferred */
  async statusByInvoice(_invoice: string): Promise<CourierStatus> {
    throw new Error("SteadfastAdapter.statusByInvoice not implemented");
  }

  /** GET /status_by_cid/{id} */
  async statusByConsignmentId(_id: string): Promise<CourierStatus> {
    throw new Error("SteadfastAdapter.statusByConsignmentId not implemented");
  }

  /** GET /status_by_trackingcode/{code} */
  async statusByTrackingCode(_code: string): Promise<CourierStatus> {
    throw new Error("SteadfastAdapter.statusByTrackingCode not implemented");
  }

  /** GET /get_balance */
  async getBalance(): Promise<number> {
    throw new Error("SteadfastAdapter.getBalance not implemented");
  }

  /** Return endpoint - for refused deliveries */
  async createReturnRequest(_r: ReturnRequest): Promise<ReturnResult> {
    throw new Error("SteadfastAdapter.createReturnRequest not implemented");
  }
}
