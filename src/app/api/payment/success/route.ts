import { gatewayReturn } from "@/lib/payments/redirects";

export const dynamic = "force-dynamic";

/** SSLCommerz success_url. Display only - never marks anything paid. */
export const GET = (req: Request) => gatewayReturn(req, "success");
export const POST = (req: Request) => gatewayReturn(req, "success");
