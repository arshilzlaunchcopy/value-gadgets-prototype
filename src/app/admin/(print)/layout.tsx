import { requireAdminPage } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

/** Chrome-less admin pages meant for printing (labels, invoices). Still admin-only. */
export default async function AdminPrintLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage("/admin");
  return <div className="bg-paper-soft min-h-dvh print:bg-white">{children}</div>;
}
