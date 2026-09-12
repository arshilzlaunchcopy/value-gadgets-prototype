"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import { inviteAdminAction, resetAdminPasswordAction, setAdminActiveAction, setAdminRoleAction } from "./actions";

interface Row {
  id: string;
  email: string;
  full_name: string;
  role: "owner" | "manager" | "staff";
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export function StaffManager({ rows, me, isOwner }: { rows: Row[]; me: string; isOwner: boolean }) {
  const router = useRouter();
  const [invite, setInvite] = useState({ email: "", full_name: "", role: "staff" });
  const [temp, setTemp] = useState<{ email: string; password: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string; data?: { tempPassword?: string } }>, email?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "Failed");
      toast.success(r.message ?? "Done");
      if (r.data?.tempPassword) setTemp({ email: email ?? "", password: r.data.tempPassword });
      router.refresh();
    });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <section className="bg-paper overflow-x-auto rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-paper-soft text-left text-xs uppercase"><tr><th className="px-3 py-2">Admin</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Last login</th><th className="px-3 py-2">Status</th><th className="px-3 py-2" /></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className={`border-t ${u.is_active ? "" : "opacity-60"}`}>
                <td className="px-3 py-2"><span className="font-medium">{u.full_name || u.email}</span>{u.id === me && <span className="text-muted-foreground text-xs"> (you)</span>}<span className="text-muted-foreground block text-xs">{u.email}</span></td>
                <td className="px-3 py-2">
                  {isOwner ? (
                    <select value={u.role} disabled={pending || u.id === me} onChange={(e) => run(() => setAdminRoleAction(u.id, e.target.value))} className="bg-paper rounded-lg border px-2 py-1 text-xs" aria-label={`Role for ${u.email}`}>
                      <option value="owner">owner</option>
                      <option value="manager">manager</option>
                      <option value="staff">staff</option>
                    </select>
                  ) : (
                    <span className="text-xs">{u.role}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">{u.last_login_at ? formatDateTime(u.last_login_at) : "never"}</td>
                <td className="px-3 py-2 text-xs">{u.is_active ? "active" : "deactivated"}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {isOwner && u.id !== me && (
                    <>
                      <Button size="sm" variant="ghost" className="rounded-lg text-xs" disabled={pending} onClick={() => run(() => setAdminActiveAction(u.id, !u.is_active))}>{u.is_active ? "Deactivate" : "Reactivate"}</Button>
                      <Button size="sm" variant="ghost" className="rounded-lg text-xs" disabled={pending} onClick={() => confirm(`Reset the password for ${u.email}?`) && run(() => resetAdminPasswordAction(u.id), u.email)}>Reset password</Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <aside className="space-y-4">
        {isOwner ? (
          <section className="bg-paper space-y-2 rounded-2xl border p-4 text-sm">
            <h2 className="font-semibold">Invite an admin</h2>
            <div className="space-y-1"><Label htmlFor="inv-email" className="text-xs">Email</Label><Input id="inv-email" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} className="rounded-lg" /></div>
            <div className="space-y-1"><Label htmlFor="inv-name" className="text-xs">Name</Label><Input id="inv-name" value={invite.full_name} onChange={(e) => setInvite({ ...invite, full_name: e.target.value })} className="rounded-lg" /></div>
            <div className="space-y-1">
              <Label htmlFor="inv-role" className="text-xs">Role</Label>
              <select id="inv-role" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })} className="bg-paper h-10 w-full rounded-lg border px-3 text-sm">
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            <Button className="w-full rounded-lg" disabled={pending || !invite.email || !invite.full_name} onClick={() => run(() => inviteAdminAction(invite), invite.email)}>Create admin</Button>
            <p className="text-muted-foreground text-xs">A one-time password is shown once. Sending invite emails needs an email provider (go-live).</p>
          </section>
        ) : (
          <p className="bg-paper text-muted-foreground rounded-2xl border p-4 text-xs">Only owners can invite or change roles.</p>
        )}
        {temp && (
          <section className="bg-amber/15 space-y-1 rounded-2xl border p-4 text-sm" role="status">
            <p className="font-semibold">Temporary password for {temp.email}</p>
            <p className="font-mono text-base">{temp.password}</p>
            <p className="text-xs">Share it over a private channel; it is not shown again.</p>
            <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setTemp(null)}>Dismiss</Button>
          </section>
        )}
      </aside>
    </div>
  );
}
