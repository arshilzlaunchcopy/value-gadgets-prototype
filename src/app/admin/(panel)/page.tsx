import { Dashboard } from "@/components/admin/dashboard";
import { PageHeader } from "@/components/admin/page-header";

export const metadata = { title: "Dashboard" };

export default function AdminDashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Revenue excludes cancelled, returned and refunded orders. Times are Asia/Dhaka." />
      <Dashboard />
    </>
  );
}
