"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Controller, useFieldArray, useForm, useFormContext, FormProvider, type Control } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { FieldSpec } from "@/lib/blocks/fields";
import { MediaPicker } from "./media-picker";
import { SortableItem, SortableList } from "./sortable";

/**
 * Renders a form from FieldSpec[] (derived from a zod schema on the server).
 * React Hook Form owns the state; every change is reported upward (debounced by the caller).
 */
export function SchemaForm({ fields, values, onChange, idPrefix = "f" }: { fields: FieldSpec[]; values: Record<string, unknown>; onChange: (values: Record<string, unknown>) => void; idPrefix?: string }) {
  const form = useForm<Record<string, unknown>>({ defaultValues: values, mode: "onChange" });
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    const sub = form.watch((v) => onChangeRef.current(structuredClone(v) as Record<string, unknown>));
    return () => sub.unsubscribe();
  }, [form]);

  return (
    <FormProvider {...form}>
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        {fields.map((f) => (
          <Field key={f.name} spec={f} path={f.name} id={`${idPrefix}-${f.name}`} />
        ))}
      </form>
    </FormProvider>
  );
}

function Help({ text }: { text?: string }) {
  return text ? <p className="text-muted-foreground text-xs">{text}</p> : null;
}

function Field({ spec, path, id }: { spec: FieldSpec; path: string; id: string }) {
  const { register, control } = useFormContext();
  const label = (
    <Label htmlFor={id} className="text-sm">
      {spec.label}
      {spec.required && <span className="text-danger ml-0.5">*</span>}
    </Label>
  );

  switch (spec.kind) {
    case "boolean":
      return (
        <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <div>
            {label}
            <Help text={spec.description} />
          </div>
          <Controller control={control} name={path} render={({ field }) => <Switch id={id} checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
        </div>
      );
    case "select":
      return (
        <div className="space-y-1">
          {label}
          <select id={id} {...register(path)} className="bg-paper w-full rounded-lg border px-3 py-2 text-sm">
            {!spec.required && <option value="">—</option>}
            {spec.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Help text={spec.description} />
        </div>
      );
    case "number":
      return (
        <div className="space-y-1">
          {label}
          <Input id={id} type="number" min={spec.min} max={spec.max} step={spec.step ?? "any"} {...register(path, { valueAsNumber: true })} className="rounded-lg" />
          <Help text={spec.description} />
        </div>
      );
    case "textarea":
    case "markdown":
      return (
        <div className="space-y-1">
          {label}
          <Textarea id={id} rows={spec.kind === "markdown" ? 8 : 3} maxLength={spec.max} {...register(path)} className="rounded-lg font-mono text-xs" />
          <Help text={spec.description ?? (spec.kind === "markdown" ? "Markdown supported" : undefined)} />
        </div>
      );
    case "color":
      return (
        <div className="space-y-1">
          {label}
          <Controller
            control={control}
            name={path}
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <input type="color" value={typeof field.value === "string" && /^#[0-9a-f]{6}$/i.test(field.value) ? field.value : "#000000"} onChange={(e) => field.onChange(e.target.value)} className="size-9 cursor-pointer rounded border" aria-label={spec.label} />
                <Input id={id} value={String(field.value ?? "")} onChange={(e) => field.onChange(e.target.value)} className="rounded-lg font-mono text-xs" />
              </div>
            )}
          />
          <Help text={spec.description} />
        </div>
      );
    case "image":
      return (
        <div className="space-y-1">
          {label}
          <Controller control={control} name={path} render={({ field }) => <MediaPicker value={String(field.value ?? "")} onChange={field.onChange} label={spec.label} />} />
          <Help text={spec.description} />
        </div>
      );
    case "datetime":
      return (
        <div className="space-y-1">
          {label}
          <Input id={id} type="datetime-local" {...register(path)} className="rounded-lg" />
          <Help text={spec.description} />
        </div>
      );
    case "list":
      return (
        <div className="space-y-1">
          {label}
          <Controller
            control={control}
            name={path}
            render={({ field }) => (
              <Textarea
                id={id}
                rows={4}
                value={Array.isArray(field.value) ? (field.value as string[]).join("\n") : ""}
                onChange={(e) => field.onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
                className="rounded-lg font-mono text-xs"
              />
            )}
          />
          <Help text={spec.description ?? "One per line"} />
        </div>
      );
    case "group":
      return (
        <fieldset className="space-y-3 rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">{spec.label}</legend>
          {spec.fields?.map((f) => (
            <Field key={f.name} spec={f} path={`${path}.${f.name}`} id={`${id}-${f.name}`} />
          ))}
        </fieldset>
      );
    case "repeater":
      return <Repeater spec={spec} path={path} id={id} control={control} />;
    case "link":
    case "url":
    case "text":
    default:
      return (
        <div className="space-y-1">
          {label}
          <Input id={id} type={spec.kind === "url" ? "url" : "text"} maxLength={spec.max} placeholder={spec.kind === "link" ? "/collection/eid-offers or https://…" : undefined} {...register(path)} className="rounded-lg" />
          <Help text={spec.description} />
        </div>
      );
  }
}

function Repeater({ spec, path, id, control }: { spec: FieldSpec; path: string; id: string; control: Control<Record<string, unknown>> }) {
  const { fields, append, remove, move } = useFieldArray({ control, name: path as never });
  const blank = () => Object.fromEntries((spec.fields ?? []).map((f) => [f.name, f.default ?? (f.kind === "boolean" ? false : f.kind === "number" ? 0 : f.kind === "repeater" || f.kind === "list" ? [] : "")]));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">
          {spec.label} <span className="text-muted-foreground font-normal">({fields.length}{spec.max ? ` / ${spec.max}` : ""})</span>
        </Label>
        <Button type="button" size="sm" variant="outline" className="rounded-lg" disabled={spec.max !== undefined && fields.length >= spec.max} onClick={() => append(blank() as never)}>
          <Plus className="size-3.5" /> Add
        </Button>
      </div>
      <Help text={spec.description} />
      <SortableList ids={fields.map((f) => f.id)} onReorder={(from, to) => move(from, to)}>
        <div className="space-y-2">
          {fields.map((f, i) => (
            <SortableItem key={f.id} id={f.id} className="bg-paper-soft rounded-lg border">
              {(handle) => (
                <details className="group" open={fields.length <= 3}>
                  <summary className="flex cursor-pointer items-center gap-1 px-2 py-1.5 text-sm">
                    {handle}
                    <RowTitle path={`${path}.${i}`} spec={spec} index={i} />
                    <button type="button" aria-label="Remove" onClick={() => remove(i)} className="text-muted-foreground hover:text-danger ml-auto rounded p-1">
                      <Trash2 className="size-3.5" />
                    </button>
                  </summary>
                  <div className="space-y-3 border-t px-3 py-3">
                    {spec.fields?.map((c) => (
                      <Field key={c.name} spec={c} path={`${path}.${i}.${c.name}`} id={`${id}-${i}-${c.name}`} />
                    ))}
                  </div>
                </details>
              )}
            </SortableItem>
          ))}
        </div>
      </SortableList>
    </div>
  );
}

function RowTitle({ path, spec, index }: { path: string; spec: FieldSpec; index: number }) {
  const { watch } = useFormContext();
  const v = spec.itemLabel ? watch(`${path}.${spec.itemLabel}`) : undefined;
  return <span className="truncate font-medium">{typeof v === "string" && v ? v : `${spec.label.replace(/s$/, "")} ${index + 1}`}</span>;
}
