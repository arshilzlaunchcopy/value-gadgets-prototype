export interface CourierScore {
  phone: string;
  totalParcels: number;
  totalDelivered: number;
  totalCancelled: number;
  /** 0-100, null for a phone with no history */
  successRatio: number | null;
  fraudReportCount: number;
  /** Plain-language label for the admin panel */
  riskLabel: "new" | "trusted" | "good" | "mixed" | "risky" | "flagged";
  raw?: unknown;
}

/**
 * CourierScoreAdapter (BUILD_PROMPT_PART2 §14.5 / PART3 §20.4).
 * Advisory only. Callers wrap it in a 5 s timeout and cache 7 days.
 */
export interface CourierScoreAdapter {
  readonly name: string;
  readonly isMock: boolean;
  check(phone: string): Promise<CourierScore>;
}
