import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdminPage } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { StaffManager } from "./staff-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff" };

export default async function StaffPage() {
  const session = await requireAdminPage("/admin/staff");
  const { data } = await createAdminClient().from("admin_users").select("id, email, full_name, role, is_active, last_login_at, created_at").order("created_at");
  return (
    <>
      <PageHeader title="Staff" description="Owners manage roles; managers run orders, products and settings; staff handle orders and content." actions={<Link href="/admin/audit" className="rounded-lg border px-3 py-1.5 text-sm">Audit log</Link>} />
      <StaffManager rows={(data ?? []).map((u) => ({ id: u.id, email: u.email ?? "", full_name: u.full_name ?? "", role: u.role as "owner" | "manager" | "staff", is_active: u.is_active, last_login_at: u.last_login_at, created_at: u.created_at }))} me={session.userId} isOwner={session.role === "owner"} />
    </>
  );
}
