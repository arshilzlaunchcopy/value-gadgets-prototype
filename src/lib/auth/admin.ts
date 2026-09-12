import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AdminRole = "owner" | "manager" | "staff";

export interface AdminSession {
  userId: string;
  email: string | null;
  role: AdminRole;
  fullName: string | null;
}

/** Current admin (cookie session + active admin_users row), or null. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("admin_users").select("id, email, role, full_name, is_active").eq("id", user.id).maybeSingle();
  if (!data || !data.is_active) return null;
  return { userId: data.id, email: data.email, role: data.role as AdminRole, fullName: data.full_name };
}

/** For admin pages: redirect to login when there is no admin session. */
export async function requireAdminPage(next?: string): Promise<AdminSession> {
  const s = await getAdminSession();
  if (!s) redirect(`/admin/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return s;
}

/** For Server Actions and route handlers: throw when not an admin. */
export async function requireAdmin(minRole: AdminRole = "staff"): Promise<AdminSession> {
  const s = await getAdminSession();
  if (!s) throw new Error("Not signed in as an admin");
  const rank: Record<AdminRole, number> = { staff: 1, manager: 2, owner: 3 };
  if (rank[s.role] < rank[minRole]) throw new Error(`Requires ${minRole} role`);
  return s;
}
