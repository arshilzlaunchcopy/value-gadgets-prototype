import "server-only";

import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { MediaStorage } from "./storage";

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
}

/** Cloudflare R2 through its S3-compatible API. */
export class R2Storage implements MediaStorage {
  readonly kind = "r2" as const;
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly base: string;

  constructor(cfg: R2Config) {
    this.bucket = cfg.bucket;
    this.base = cfg.publicBaseUrl.replace(/\/+$/, "");
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
  }

  async put(key: string, body: Buffer, contentType: string, cacheControl: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: cacheControl,
      }),
    );
    return this.publicUrl(key);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (err) {
      const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (e.name === "NotFound" || e.$metadata?.httpStatusCode === 404) return false;
      throw err;
    }
  }

  publicUrl(key: string): string {
    return `${this.base}/${key}`;
  }
}
