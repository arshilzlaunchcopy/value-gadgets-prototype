import { gatewayReturn } from "@/lib/payments/redirects";

export const dynamic = "force-dynamic";

/** SSLCommerz fail_url. Display only. */
export const GET = (req: Request) => gatewayReturn(req, "failed");
export const POST = (req: Request) => gatewayReturn(req, "failed");
