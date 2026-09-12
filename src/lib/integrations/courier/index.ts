import "server-only";

import { isDemoMode, requireEnv } from "@/lib/env";
import { MockCourierAdapter } from "./mock";
import { SteadfastAdapter } from "./steadfast";
import type { CourierAdapter } from "./types";

export type {
  BulkResult,
  CourierAdapter,
  CourierStatus,
  DispatchPayload,
  DispatchResult,
  NormalizedCourierStatus,
  ReturnRequest,
  ReturnResult,
} from "./types";
export { CourierOutageError } from "./mock";

let instance: CourierAdapter | null = null;

export function getCourier(): CourierAdapter {
  if (instance) return instance;
  instance = isDemoMode()
    ? new MockCourierAdapter()
    : new SteadfastAdapter({
        apiKey: requireEnv("STEADFAST_API_KEY"),
        secretKey: requireEnv("STEADFAST_SECRET_KEY"),
      });
  return instance;
}
