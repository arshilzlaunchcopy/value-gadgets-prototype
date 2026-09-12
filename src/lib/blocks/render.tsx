import "server-only";

import { getPublishedBlocks, visibleNow } from "./content";
import type { BlockRow, Locale, PageType } from "./define";
import { getBlock } from "./registry";

interface Props {
  pageType: PageType;
  targetId?: string | null;
  locale?: Locale;
  /** Render these rows instead of the published ones (draft preview). */
  blocks?: BlockRow[];
  /** Rendered when there is nothing to show. */
  fallback?: React.ReactNode;
}

/**
 * Server-side block renderer (PART2 §16.2: server components; only islands
 * inside blocks are client). Invalid rows are skipped and logged, never fatal.
 */
export async function BlockRenderer({ pageType, targetId = null, locale = "en", blocks, fallback = null }: Props) {
  const rows = blocks ?? (await getPublishedBlocks(pageType, targetId)).blocks;
  const visible = visibleNow(rows, locale);
  if (visible.length === 0) return <>{fallback}</>;

  const rendered = await Promise.all(
    visible.map(async (row) => {
      const def = getBlock(row.block_type);
      if (!def) {
        console.warn(`[blocks] unknown block type "${row.block_type}" (${row.id})`);
        return null;
      }
      const parsed = def.schema.safeParse(row.settings);
      if (!parsed.success) {
        console.warn(`[blocks] invalid settings for ${row.block_type} (${row.id}): ${parsed.error.issues[0]?.message}`);
        return null;
      }
      const data = def.loader ? await def.loader(parsed.data, { targetId, locale }) : undefined;
      const Comp = def.component;
      return (
        <section key={row.id} data-block={row.block_type} data-block-id={row.id}>
          {await Comp({ settings: parsed.data, data, locale, targetId })}
        </section>
      );
    }),
  );
  return <div className="space-y-10">{rendered}</div>;
}
