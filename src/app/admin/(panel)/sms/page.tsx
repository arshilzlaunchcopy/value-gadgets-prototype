import { PageHeader } from "@/components/admin/page-header";
import { formatDateTime } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "SMS log" };

export default async function SmsLogPage() {
  const { data } = await createAdminClient().from("demo_sms_log").select("id, to_phone, kind, status, provider, message, error, sent_at").order("sent_at", { ascending: false }).limit(100);
  return (
    <>
      <PageHeader title="SMS log" description="Every message the SMS adapter sent (or failed to send). In demo mode nothing leaves the building." />
      <div className="bg-paper overflow-x-auto rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-paper-soft text-left text-xs uppercase"><tr><th className="px-3 py-2">When</th><th className="px-3 py-2">To</th><th className="px-3 py-2">Kind</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Message</th></tr></thead>
          <tbody>
            {(data ?? []).map((m) => (
              <tr key={m.id} className="border-t">
                <td className="px-3 py-2 text-xs whitespace-nowrap">{formatDateTime(m.sent_at)}</td>
                <td className="px-3 py-2 font-mono text-xs">{m.to_phone}</td>
                <td className="px-3 py-2">{m.kind}</td>
                <td className={`px-3 py-2 ${m.status === "failed" ? "text-danger" : "text-success-deep"}`}>{m.status}{m.error ? ` · ${m.error}` : ""}</td>
                <td className="max-w-xl px-3 py-2">{m.message}</td>
              </tr>
            ))}
            {!data?.length && <tr><td colSpan={5} className="text-muted-foreground px-3 py-8 text-center">No messages yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
