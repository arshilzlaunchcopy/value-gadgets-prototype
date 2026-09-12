import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { MediaStorage } from "./storage";

/** Supabase Storage fallback (public bucket created in migration 20260912000900). */
export class SupabaseStorage implements MediaStorage {
  readonly kind = "supabase" as const;

  constructor(private readonly bucket: string) {}

  async put(key: string, body: Buffer, contentType: string, cacheControl: string): Promise<string> {
    const admin = createAdminClient();
    // Supabase takes max-age seconds; the CDN adds the rest.
    const maxAge = /max-age=(\d+)/.exec(cacheControl)?.[1] ?? "31536000";
    const { error } = await admin.storage
      .from(this.bucket)
      .upload(key, body, { contentType, cacheControl: maxAge, upsert: true });
    if (error) throw new Error(`Supabase Storage upload failed for ${key}: ${error.message}`);
    return this.publicUrl(key);
  }

  async exists(key: string): Promise<boolean> {
    const admin = createAdminClient();
    const slash = key.lastIndexOf("/");
    const dir = slash === -1 ? "" : key.slice(0, slash);
    const name = slash === -1 ? key : key.slice(slash + 1);
    const { data, error } = await admin.storage.from(this.bucket).list(dir, { search: name, limit: 5 });
    if (error) throw new Error(`Supabase Storage list failed for ${key}: ${error.message}`);
    return (data ?? []).some((o) => o.name === name);
  }

  publicUrl(key: string): string {
    const admin = createAdminClient();
    return admin.storage.from(this.bucket).getPublicUrl(key).data.publicUrl;
  }
}
