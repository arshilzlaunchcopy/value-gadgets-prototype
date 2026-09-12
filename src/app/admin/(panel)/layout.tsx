import { AdminShell } from "@/components/admin/shell";
import { QueryProvider } from "@/components/admin/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { requireAdminPage } from "@/lib/auth/admin";
import { getStoreSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Guarded admin area: session + active admin_users row, dark shell, TanStack Query. */
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const [session, store] = await Promise.all([requireAdminPage("/admin"), getStoreSettings()]);
  return (
    <QueryProvider>
      <AdminShell storeName={store.name} user={{ email: session.email ?? "", role: session.role, name: session.fullName }}>
        {children}
      </AdminShell>
      <Toaster position="top-right" richColors />
    </QueryProvider>
  );
}
