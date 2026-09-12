import "server-only";

import type { BlockDefinition, PageType } from "./define";
import { schemaToFields, type FieldSpec } from "./fields";

/**
 * Every file in ./types is a block (webpack require.context). Adding a block
 * type = adding one file there. Nothing else changes (§13.1).
 */
const ctx = require.context("./types", false, /\.tsx$/);

export const BLOCKS: Record<string, BlockDefinition> = {};
for (const key of ctx.keys()) {
  const mod = ctx(key) as { default?: BlockDefinition };
  const def = mod.default;
  if (!def || !def.type) {
    console.warn(`[blocks] ${key} has no default defineBlock() export`);
    continue;
  }
  if (BLOCKS[def.type]) console.warn(`[blocks] duplicate block type "${def.type}" in ${key}`);
  BLOCKS[def.type] = def;
}

export function getBlock(type: string): BlockDefinition | null {
  return BLOCKS[type] ?? null;
}

/** Client-safe description of a block: metadata + derived form fields, no zod, no component. */
export interface BlockMeta {
  type: string;
  label: string;
  icon: string;
  description?: string;
  allowedOn: PageType[];
  defaults: Record<string, unknown>;
  fields: FieldSpec[];
}

export function blockMeta(def: BlockDefinition): BlockMeta {
  // A block author's defaults should satisfy the schema; if not, warn and fall back to the raw defaults
  // rather than taking the whole admin down.
  const parsed = def.schema.safeParse(def.defaults);
  if (!parsed.success) console.warn(`[blocks] defaults for "${def.type}" do not satisfy its schema: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`);
  return {
    type: def.type,
    label: def.label,
    icon: def.icon,
    description: def.description,
    allowedOn: def.allowedOn,
    defaults: (parsed.success ? parsed.data : def.defaults) as Record<string, unknown>,
    fields: schemaToFields(def.schema),
  };
}

export function listBlocks(pageType?: PageType): BlockMeta[] {
  return Object.values(BLOCKS)
    .filter((b) => !pageType || b.allowedOn.includes(pageType))
    .sort((a, b) => a.label.localeCompare(b.label))
    .map(blockMeta);
}

/** Validate + normalise settings for a block type. Returns null when invalid. */
export function parseSettings(type: string, settings: unknown): { ok: true; settings: Record<string, unknown> } | { ok: false; error: string } {
  const def = getBlock(type);
  if (!def) return { ok: false, error: `unknown block type "${type}"` };
  const r = def.schema.safeParse(settings ?? def.defaults);
  if (!r.success) return { ok: false, error: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  return { ok: true, settings: r.data as Record<string, unknown> };
}
