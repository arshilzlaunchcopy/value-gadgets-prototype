import "server-only";

import { R2Storage } from "./storage-r2";
import { SupabaseStorage } from "./storage-supabase";

/**
 * Where processed image variants live. Two implementations:
 *   - Cloudflare R2 (preferred; 10 GB free, zero egress through Cloudflare)
 *   - Supabase Storage (fallback when R2 credentials are blank)
 */
export interface MediaStorage {
  readonly kind: "r2" | "supabase";
  /** Upload and return the public URL. */
  put(key: string, body: Buffer, contentType: string, cacheControl: string): Promise<string>;
  exists(key: string): Promise<boolean>;
  publicUrl(key: string): string;
}

let instance: MediaStorage | null = null;
let warned = false;

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_BASE_URL,
  );
}

export function getMediaStorage(): MediaStorage {
  if (instance) return instance;
  if (isR2Configured()) {
    instance = new R2Storage({
      accountId: process.env.R2_ACCOUNT_ID!,
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      bucket: process.env.R2_BUCKET!,
      publicBaseUrl: process.env.R2_PUBLIC_BASE_URL!,
    });
  } else {
    if (!warned) {
      warned = true;
      console.warn(
        "[media] R2 credentials are blank - falling back to Supabase Storage bucket 'product-images'. " +
          "Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_PUBLIC_BASE_URL to use R2.",
      );
    }
    instance = new SupabaseStorage("product-images");
  }
  return instance;
}

/** Test hook: forget the cached instance (e.g. after changing env). */
export function resetMediaStorage(): void {
  instance = null;
}
