import type { ReactNode } from "react";
import type { z } from "zod";

/** Page types a block may be placed on (BUILD_PROMPT_PART2 §13.3). */
export type PageType = "home" | "product" | "category" | "collection" | "page" | "landing" | "custom";
export const PAGE_TYPES: PageType[] = ["home", "product", "category", "collection", "page", "landing", "custom"];

export type Locale = "en" | "bn";

export interface BlockComponentProps<S, D> {
  settings: S;
  /** result of the block's loader (products, categories...) or undefined */
  data: D;
  locale: Locale;
  /** the entity the page is about (product/category/collection id) when rendering an instance */
  targetId: string | null;
}

/**
 * A block is defined ONCE (§13.1): zod schema + metadata + component.
 * From that we derive the TS props, the runtime validation and the admin form.
 * `loader` runs on the server before render so components stay pure.
 */
export interface BlockDefinition<S extends z.ZodTypeAny = z.ZodTypeAny, D = undefined> {
  type: string;
  label: string;
  /** lucide icon name (rendered by the admin) */
  icon: string;
  description?: string;
  allowedOn: PageType[];
  schema: S;
  defaults: z.input<S>;
  component: (props: BlockComponentProps<z.output<S>, D>) => ReactNode | Promise<ReactNode>;
  loader?: (settings: z.output<S>, ctx: { targetId: string | null; locale: Locale }) => Promise<D>;
}

export function defineBlock<S extends z.ZodTypeAny, D = undefined>(def: BlockDefinition<S, D>): BlockDefinition<S, D> {
  return def;
}

/** Row shape shared by content_blocks (live) and content_drafts.blocks (working copy). */
export interface BlockRow {
  id: string;
  block_type: string;
  settings: Record<string, unknown>;
  is_visible: boolean;
  visible_from: string | null;
  visible_until: string | null;
  locale: Locale | null;
}
