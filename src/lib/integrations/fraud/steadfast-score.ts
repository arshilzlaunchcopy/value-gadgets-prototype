import "server-only";

import type { CourierScore, CourierScoreAdapter } from "./types";

export interface SteadfastScoreConfig {
  apiKey: string;
  secretKey: string;
}

/** Real Steadfast courier-score adapter. Implemented at go-live; rate-limited upstream. */
export class SteadfastScoreAdapter implements CourierScoreAdapter {
  readonly name = "steadfast-score";
  readonly isMock = false;

  constructor(private readonly cfg: SteadfastScoreConfig) {}

  async check(_phone: string): Promise<CourierScore> {
    void this.cfg;
    throw new Error("SteadfastScoreAdapter.check not implemented");
  }
}
