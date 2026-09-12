import type { z } from "zod";

/**
 * Derive admin form fields from a zod schema (BUILD_PROMPT_PART2 §13.1).
 * Mapping: string -> text (or textarea / markdown / url / image / link / color by name & checks),
 * number -> number, boolean -> switch, enum -> select, array(object) -> repeater,
 * array(string) -> list, object -> group. `.describe()` becomes help text.
 * The output is plain JSON, so client components never import zod.
 */
export type FieldKind = "text" | "textarea" | "markdown" | "number" | "boolean" | "select" | "url" | "image" | "link" | "color" | "repeater" | "list" | "group" | "datetime";

export interface FieldSpec {
  name: string;
  label: string;
  kind: FieldKind;
  description?: string;
  required: boolean;
  default?: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  /** repeater / group children */
  fields?: FieldSpec[];
  /** repeater: child field used as the row title */
  itemLabel?: string;
}

// zod 4 internals, accessed in exactly one place
interface ZDef {
  type: string;
  innerType?: z.ZodTypeAny;
  defaultValue?: unknown | (() => unknown);
  checks?: { _zod: { def: Record<string, unknown> } }[];
  element?: z.ZodTypeAny;
  shape?: Record<string, z.ZodTypeAny>;
  entries?: Record<string, string>;
  values?: unknown[];
}
const defOf = (s: z.ZodTypeAny): ZDef => (s as unknown as { _zod: { def: ZDef } })._zod.def;

export function humanize(name: string): string {
  const base = name.replace(/_(en|bn)$/, "");
  const suffix = /_en$/.test(name) ? " (EN)" : /_bn$/.test(name) ? " (BN)" : "";
  return base.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) + suffix;
}

function unwrap(schema: z.ZodTypeAny): { inner: z.ZodTypeAny; required: boolean; def?: unknown } {
  let s = schema;
  let required = true;
  let dflt: unknown = undefined;
  for (let i = 0; i < 6; i++) {
    const d = defOf(s);
    if (d.type === "optional" || d.type === "nullable") {
      required = false;
      s = d.innerType!;
    } else if (d.type === "default") {
      required = false;
      dflt = typeof d.defaultValue === "function" ? (d.defaultValue as () => unknown)() : d.defaultValue;
      s = d.innerType!;
    } else break;
  }
  return { inner: s, required, def: dflt };
}

function stringKind(name: string, checks: Record<string, unknown>[], maxLen?: number): FieldKind {
  const n = name.toLowerCase();
  if (/(^|_)(image|logo|photo|cover|banner|thumbnail)(_|$)|_image$|image_/.test(n)) return "image";
  if (/color|colour/.test(n)) return "color";
  if (/(^|_)(href|link|url)$|^link_|_href$|^cta_href|^href$/.test(n) && !/image/.test(n)) return "link";
  if (checks.some((c) => c.format === "url")) return "url";
  if (checks.some((c) => c.format === "datetime")) return "datetime";
  if (/markdown|body|content|rich/.test(n)) return "markdown";
  if (/(description|text|subheading|answer|note|caption)/.test(n) && (maxLen === undefined || maxLen > 160)) return "textarea";
  return "text";
}

export function schemaToFields(schema: z.ZodTypeAny): FieldSpec[] {
  const { inner } = unwrap(schema);
  const d = defOf(inner);
  if (d.type !== "object" || !d.shape) return [];
  return Object.entries(d.shape).map(([name, child]) => fieldFor(name, child));
}

function fieldFor(name: string, schema: z.ZodTypeAny): FieldSpec {
  const { inner, required, def } = unwrap(schema);
  const d = defOf(inner);
  const checks = (d.checks ?? []).map((c) => c._zod.def);
  const base: FieldSpec = { name, label: humanize(name), kind: "text", required, default: def, description: (schema as { description?: string }).description ?? (inner as { description?: string }).description };

  switch (d.type) {
    case "string": {
      const min = checks.find((c) => c.check === "min_length")?.minimum as number | undefined;
      const max = checks.find((c) => c.check === "max_length")?.maximum as number | undefined;
      return { ...base, kind: stringKind(name, checks, max), min, max };
    }
    case "number": {
      const gt = checks.find((c) => c.check === "greater_than");
      const lt = checks.find((c) => c.check === "less_than");
      const isInt = checks.some((c) => c.check === "number_format" && /int/.test(String(c.format)));
      return { ...base, kind: "number", min: gt?.value as number | undefined, max: lt?.value as number | undefined, step: isInt ? 1 : undefined };
    }
    case "boolean":
      return { ...base, kind: "boolean" };
    case "enum": {
      const values = Object.values(d.entries ?? {}).map(String);
      return { ...base, kind: "select", options: values.map((v) => ({ value: v, label: humanize(v) })) };
    }
    case "array": {
      const el = unwrap(d.element!).inner;
      const ed = defOf(el);
      const min = checks.find((c) => c.check === "min_length")?.minimum as number | undefined;
      const max = checks.find((c) => c.check === "max_length")?.maximum as number | undefined;
      if (ed.type === "object" && ed.shape) {
        const fields = Object.entries(ed.shape).map(([n, c]) => fieldFor(n, c));
        const itemLabel = fields.find((f) => ["text", "textarea"].includes(f.kind))?.name;
        return { ...base, kind: "repeater", fields, min, max, itemLabel };
      }
      return { ...base, kind: "list", min, max };
    }
    case "object":
      return { ...base, kind: "group", fields: Object.entries(d.shape ?? {}).map(([n, c]) => fieldFor(n, c)) };
    default:
      return base;
  }
}
