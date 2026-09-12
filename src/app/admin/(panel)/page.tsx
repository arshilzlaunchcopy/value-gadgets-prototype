import Link from "next/link";
import { Dashboard } from "@/components/admin/dashboard";
import { PageHeader } from "@/components/admin/page-header";
import { formatBDT } from "@/lib/format";
import { getCourier } from "@/lib/integrations/courier";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

/** Courier balance widget with a low-balance warning (PART2 §14.7). */
async function CourierBalance() {
  let balance: number | null = null;
  let name = "courier";
  try {
    const c = getCourier();
    name = c.name;
    balance = await c.getBalance();
  } catch {
    balance = null;
  }
  const { data } = await createAdminClient().from("settings").select("value").eq("key", "courier").maybeSingle();
  const low = Number(((data?.value as { low_balance_warning_bdt?: number } | null) ?? {}).low_balance_warning_bdt ?? 5000);
  const warn = balance !== null && balance < low;
  return (
    <Link href="/admin/courier" className={`mb-4 flex items-center justify-between rounded-2xl border p-4 text-sm ${warn ? "bg-danger/5 border-danger/40" : "bg-paper"}`}>
      <span>
        <span className="text-muted-foreground block text-xs font-medium uppercase">{name} balance</span>
        <span className="price text-xl">{balance === null ? "unavailable" : formatBDT(balance)}</span>
      </span>
      <span className={`text-xs ${warn ? "text-danger font-semibold" : "text-muted-foreground"}`}>{warn ? `Low: below ${formatBDT(low)}. Top up before dispatch.` : "Reconciliation and open shipments →"}</span>
    </Link>
  );
}

export default function AdminDashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Revenue excludes cancelled, returned and refunded orders. Times are Asia/Dhaka." />
      <CourierBalance />
      <Dashboard />
    </>
  );
}
