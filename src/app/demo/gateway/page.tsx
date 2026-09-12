import { CreditCard, Lock, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createAdminClient } from "@/lib/supabase/admin";
import { completeGateway } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Secure payment", robots: { index: false } };

/**
 * /demo/gateway?txn=&amount=&order=  - a convincing fake BD payment gateway
 * (BUILD_PROMPT_PART3 §20.2). Card / bKash / Nagad tabs, three outcomes.
 */
export default async function GatewayPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const txn = typeof sp.txn === "string" ? sp.txn : "";
  const admin = createAdminClient();
  const { data: t } = txn
    ? await admin.from("payment_transactions").select("amount_bdt, status, orders(order_number)").eq("gateway", "mock").eq("gateway_txn_id", txn).maybeSingle()
    : { data: null };

  const amount = t?.amount_bdt ?? Number(sp.amount ?? 0);
  const orderNumber = (t?.orders as { order_number: string } | null)?.order_number ?? (typeof sp.order === "string" ? sp.order : "");
  const alreadyDone = t && t.status !== "initiated";

  return (
    <div className="bg-ink flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-4 flex items-center justify-between text-white/80">
          <span className="text-sm font-semibold tracking-wide">SECUREPAY <span className="text-amber">DEMO</span></span>
          <span className="flex items-center gap-1 text-xs"><Lock className="size-3" /> 256-bit TLS (simulated)</span>
        </div>
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-baseline justify-between">
              <span>Pay {orderNumber && <span className="text-muted-foreground text-sm font-normal">for {orderNumber}</span>}</span>
              <span className="price text-2xl">৳{amount.toLocaleString("en-IN")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!txn || !t ? (
              <p className="text-danger text-sm">Unknown or missing transaction. Start from checkout (or the demo panel) to get a valid session.</p>
            ) : alreadyDone ? (
              <p className="text-muted-foreground text-sm">This transaction is already {t.status}. Go back to the store.</p>
            ) : (
              <Tabs defaultValue="card">
                <TabsList className="mb-4 w-full">
                  <TabsTrigger value="card" className="flex-1"><CreditCard className="mr-1 size-4" /> Card</TabsTrigger>
                  <TabsTrigger value="bkash" className="flex-1"><Smartphone className="mr-1 size-4" /> bKash</TabsTrigger>
                  <TabsTrigger value="nagad" className="flex-1"><Smartphone className="mr-1 size-4" /> Nagad</TabsTrigger>
                </TabsList>
                <TabsContent value="card"><PayForm txn={txn} method="card" fields={[["Card number", "4321 49XX XXXX 0011"], ["Expiry", "12/28"], ["CVV", "***"]]} /></TabsContent>
                <TabsContent value="bkash"><PayForm txn={txn} method="bkash" fields={[["bKash number", "017XXXXXXXX"], ["PIN", "****"]]} /></TabsContent>
                <TabsContent value="nagad"><PayForm txn={txn} method="nagad" fields={[["Nagad number", "018XXXXXXXX"], ["PIN", "****"]]} /></TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-white/50">Demo gateway. No money moves. The outcome you pick is sent to the store as a real IPN.</p>
      </div>
    </div>
  );
}

function PayForm({ txn, method, fields }: { txn: string; method: "card" | "bkash" | "nagad"; fields: [string, string][] }) {
  return (
    <form action={completeGateway} className="space-y-3">
      <input type="hidden" name="txn" value={txn} />
      <input type="hidden" name="method" value={method} />
      {fields.map(([label, placeholder]) => (
        <div key={label} className="space-y-1">
          <Label>{label}</Label>
          <Input placeholder={placeholder} readOnly className="rounded-lg" />
        </div>
      ))}
      <div className="grid gap-2 pt-2">
        <Button type="submit" name="outcome" value="success" className="rounded-2xl">Pay successfully</Button>
        <Button type="submit" name="outcome" value="failed" variant="outline" className="rounded-2xl">Payment failed</Button>
        <Button type="submit" name="outcome" value="cancelled" variant="ghost" className="rounded-2xl">Cancel</Button>
      </div>
    </form>
  );
}
