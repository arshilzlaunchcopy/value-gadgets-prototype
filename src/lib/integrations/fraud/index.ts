import "server-only";

import { isDemoMode, requireEnv } from "@/lib/env";
import { MockCourierScoreAdapter } from "./mock";
import { SteadfastScoreAdapter } from "./steadfast-score";
import type { CourierScoreAdapter } from "./types";

export type { CourierScore, CourierScoreAdapter } from "./types";

let instance: CourierScoreAdapter | null = null;

export function getCourierScore(): CourierScoreAdapter {
  if (instance) return instance;
  instance = isDemoMode()
    ? new MockCourierScoreAdapter()
    : new SteadfastScoreAdapter({
        apiKey: requireEnv("STEADFAST_API_KEY"),
        secretKey: requireEnv("STEADFAST_SECRET_KEY"),
      });
  return instance;
}
