"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function signInAction(emailRaw: string, passwordRaw: string, next: string): Promise<{ ok: false; error: string } | undefined> {
  const email = z.string().trim().email().safeParse(emailRaw);
  const password = z.string().min(6).safeParse(passwordRaw);
  if (!email.success || !password.success) return { ok: false, error: "Enter your email and password" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.data, password: password.data });
  if (error || !data.user) return { ok: false, error: "Invalid email or password" };

  const { data: admin } = await supabase.from("admin_users").select("id, is_active").eq("id", data.user.id).maybeSingle();
  if (!admin || !admin.is_active) {
    await supabase.auth.signOut();
    return { ok: false, error: "This account is not an admin" };
  }
  await supabase.from("admin_users").update({ last_login_at: new Date().toISOString() }).eq("id", admin.id);
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
