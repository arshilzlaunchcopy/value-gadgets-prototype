/**
 * Bulk-ingest product photos through the image pipeline.
 *
 *   npm run images:ingest <dir> [--product <slug>] [--dry-run]
 *
 * Layouts supported:
 *   <dir>/<product-slug>/1.jpg, 2.jpg ...      (slug = folder name)
 *   <dir>/<product-slug>__1.jpg ...            (slug = part before "__")
 *   <dir>/*.jpg with --product <slug>          (all files belong to that product)
 *
 * Results are cached in supabase/seed/image-manifest.json keyed by file sha256,
 * so re-runs skip processing and uploading unchanged files.
 *
 * Must run with the react-server condition so `server-only` modules load:
 *   tsx --conditions=react-server scripts/images-ingest.ts ...   (npm script does this)
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { loadEnv } from "./lib/env";

loadEnv();

const CACHE_PATH = resolve(process.cwd(), "supabase/seed/image-manifest.json");
const EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".tif", ".tiff"]);

export interface CachedImage {
  hash: string;
  width: number;
  height: number;
  blurDataUrl: string;
  url: string;
  bytes: number;
  manifest: unknown;
}
export type ImageCache = Record<string, CachedImage>;

export function readImageCache(): ImageCache {
  if (!existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_PATH, "utf8")) as ImageCache;
  } catch {
    return {};
  }
}

export function writeImageCache(cache: ImageCache): void {
  mkdirSync(resolve(CACHE_PATH, ".."), { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

export function fileHash(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

interface Job {
  file: string;
  slug: string;
  position: number;
}

function collectJobs(dir: string, forcedSlug?: string): Job[] {
  const jobs: Job[] = [];
  const entries = readdirSync(dir).sort();
  const counters = new Map<string, number>();
  const next = (slug: string) => {
    const n = counters.get(slug) ?? 0;
    counters.set(slug, n + 1);
    return n;
  };
  for (const name of entries) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      for (const inner of readdirSync(full).sort()) {
        if (!EXTS.has(extname(inner).toLowerCase())) continue;
        const slug = forcedSlug ?? name;
        jobs.push({ file: join(full, inner), slug, position: next(slug) });
      }
      continue;
    }
    if (!EXTS.has(extname(name).toLowerCase())) continue;
    const stem = basename(name, extname(name));
    const slug = forcedSlug ?? (stem.includes("__") ? stem.split("__")[0] : stem);
    jobs.push({ file: full, slug, position: next(slug) });
  }
  return jobs;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const pIdx = args.indexOf("--product");
  const forcedSlug = pIdx !== -1 ? args[pIdx + 1] : undefined;
  const dir = args.find((a, i) => !a.startsWith("--") && (pIdx === -1 || i !== pIdx + 1));
  if (!dir) {
    console.error("Usage: npm run images:ingest <dir> [--product <slug>] [--dry-run]");
    process.exit(1);
  }
  const root = resolve(process.cwd(), dir);
  if (!existsSync(root)) {
    console.error(`Directory not found: ${root}`);
    process.exit(1);
  }

  const jobs = collectJobs(root, forcedSlug);
  console.log(`Found ${jobs.length} image(s) in ${root}`);
  if (jobs.length === 0) return;
  if (dryRun) {
    for (const j of jobs) console.log(`  ${j.slug} #${j.position}  ${j.file}`);
    return;
  }

  // Lazy imports: these pull in server-only modules.
  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const { processAndUpload } = await import("../src/lib/media/ingest");
  const admin = createAdminClient();
  const cache = readImageCache();

  const slugs = [...new Set(jobs.map((j) => j.slug))];
  const { data: products, error } = await admin.from("products").select("id, slug, title_en").in("slug", slugs);
  if (error) throw new Error(error.message);
  const bySlug = new Map((products ?? []).map((p) => [p.slug, p]));

  let processed = 0;
  let cached = 0;
  let skipped = 0;
  for (const job of jobs) {
    const product = bySlug.get(job.slug);
    if (!product) {
      console.warn(`  skip ${job.file}: no product with slug "${job.slug}"`);
      skipped++;
      continue;
    }
    const buf = readFileSync(job.file);
    const key = fileHash(buf);
    let img = cache[key];
    if (!img) {
      const up = await processAndUpload(buf);
      img = { hash: up.hash, width: up.width, height: up.height, blurDataUrl: up.blurDataUrl, url: up.url, bytes: up.bytes, manifest: up.manifest };
      cache[key] = img;
      writeImageCache(cache);
      processed++;
      console.log(`  ${up.reused ? "reused " : "uploaded"} ${job.slug} #${job.position}  ${up.width}x${up.height}  ${(up.bytes / 1024).toFixed(0)} KB total`);
    } else {
      cached++;
    }

    const row = {
      product_id: product.id,
      url: img.url,
      alt_text_en: `${product.title_en} - photo ${job.position + 1}`,
      width: img.width,
      height: img.height,
      position: job.position,
      blur_data_url: img.blurDataUrl,
      manifest: img.manifest as never,
      content_hash: img.hash,
      format: "jpeg",
      bytes: img.bytes,
    };
    const { data: existing } = await admin
      .from("product_images")
      .select("id")
      .eq("product_id", product.id)
      .eq("content_hash", img.hash)
      .maybeSingle();
    const res = existing
      ? await admin.from("product_images").update(row).eq("id", existing.id)
      : await admin.from("product_images").insert(row);
    if (res.error) throw new Error(`product_images write failed: ${res.error.message}`);
  }
  console.log(`\nDone: ${processed} processed, ${cached} from cache, ${skipped} skipped.`);
}

if (process.argv[1] && /images-ingest\.ts$/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
