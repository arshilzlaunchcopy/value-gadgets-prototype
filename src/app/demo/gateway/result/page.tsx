import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Display-only, like /api/payment/success will be: reads the order's current
 * payment_status from the database and never writes it (BUILD_PROMPT §9.5).
 */
export default async function GatewayResultPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "error";
  const orderNumber = typeof sp.order === "string" ? sp.order : "";
  const { data: order } = orderNumber
    ? await createAdminClient().from("orders").select("order_number, status, payment_status, total_bdt").eq("order_number", orderNumber).maybeSingle()
    : { data: null };

  const headline =
    status === "paid" ? "Payment received" : status === "rejected" ? "Payment could not be verified" : status === "failed" ? "Payment failed" : status === "cancelled" ? "Payment cancelled" : "Something went wrong";

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-md rounded-2xl">
        <CardHeader><CardTitle>{headline}</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">Gateway reported: <code>{status}</code></p>
          {order ? (
            <dl className="grid grid-cols-2 gap-1">
              <dt className="text-muted-foreground">Order</dt><dd>{order.order_number}</dd>
              <dt className="text-muted-foreground">Order status</dt><dd>{order.status}</dd>
              <dt className="text-muted-foreground">Payment status (from DB)</dt><dd className="font-semibold">{order.payment_status}</dd>
              <dt className="text-muted-foreground">Total</dt><dd className="price">৳{order.total_bdt.toLocaleString("en-IN")}</dd>
            </dl>
          ) : (
            <p className="text-muted-foreground">No order found for this transaction.</p>
          )}
          <div className="flex gap-2 pt-2">
            <Button asChild className="rounded-2xl"><Link href="/demo">Back to demo panel</Link></Button>
            <Button asChild variant="outline" className="rounded-2xl"><Link href="/">Store</Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
