import { NextResponse } from "next/server";
import { getCartSummary } from "@/lib/cart/queries";
import { getCartId } from "@/lib/cart/session";

export const dynamic = "force-dynamic";

/** GET /api/cart - the visitor's cart (by httpOnly cookie). Used by the header badge after mount. */
export async function GET() {
  const cart = await getCartSummary(await getCartId());
  return NextResponse.json(cart, { headers: { "Cache-Control": "no-store" } });
}
