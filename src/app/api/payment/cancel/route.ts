import { gatewayReturn } from "@/lib/payments/redirects";

export const dynamic = "force-dynamic";

/** SSLCommerz cancel_url. Display only. */
export const GET = (req: Request) => gatewayReturn(req, "cancelled");
export const POST = (req: Request) => gatewayReturn(req, "cancelled");
