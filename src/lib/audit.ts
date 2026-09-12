import "server-only";

import { headers } from "next/headers";
import type { AdminSession } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * audit_log writer (BUILD_PROMPT §4.8). Called from admin Server Actions after a
 * successful mutation. Never throws: an audit failure must not undo the action.
 */
export async function audit(session: AdminSession | null, action: string, entity: { type: string; id?: string | null; before?: unknown; after?: unknown } = { type: "system" }): Promise<void> {
  try {
    let ip: string | null = null;
    try {
      const h = await headers();
      const fwd = h.get("x-forwarded-for") ?? h.get("x-nf-client-connection-ip") ?? h.get("x-real-ip");
      ip = fwd ? fwd.split(",")[0].trim() : null;
      if (ip && !/^[\d.a-f:]+$/i.test(ip)) ip = null;
    } catch {}
    await createAdminClient().from("audit_log").insert({
      actor_id: session?.userId ?? null,
      actor_email: session?.email ?? null,
      action,
      entity_type: entity.type,
      entity_id: entity.id && /^[0-9a-f-]{36}$/i.test(entity.id) ? entity.id : null,
      before: (entity.before ?? null) as never,
      after: (entity.after ?? null) as never,
      ip,
    });
  } catch (err) {
    console.warn("[audit] failed:", err instanceof Error ? err.message : err);
  }
}
