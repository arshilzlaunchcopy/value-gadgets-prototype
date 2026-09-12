import "server-only";

import type { SmsAdapter, SmsKind, SmsResult } from "./types";

export interface AlphaSmsConfig {
  apiKey: string;
  senderId?: string;
}

/** Real Alpha SMS / BulkSMSBD adapter. Implemented at go-live (phase 17). */
export class AlphaSmsAdapter implements SmsAdapter {
  readonly name = "alpha-sms";
  readonly isMock = false;

  constructor(private readonly cfg: AlphaSmsConfig) {}

  async send(_to: string, _message: string, _kind: SmsKind): Promise<SmsResult> {
    void this.cfg;
    throw new Error("AlphaSmsAdapter.send not implemented");
  }
}
