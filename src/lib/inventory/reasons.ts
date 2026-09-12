/** Stock movement reason codes (client-safe; not in a "use server" file). */
export const STOCK_REASONS = ["received", "correction", "damaged", "return", "sample", "other"] as const;
export type StockReason = (typeof STOCK_REASONS)[number];
