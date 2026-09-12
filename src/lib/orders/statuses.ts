/** Client-safe order status constants (no server imports). */
export const ORDER_STATUSES = ["pending_payment", "awaiting_advance", "confirmed", "processing", "packed", "shipped", "delivered", "cancelled", "returned", "refunded"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const TERMINAL: OrderStatus[] = ["delivered", "cancelled", "returned", "refunded"];
export function isTerminal(s: OrderStatus): boolean {
  return TERMINAL.includes(s);
}
