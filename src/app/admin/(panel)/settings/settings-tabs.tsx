"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SchemaForm } from "@/components/admin/schema-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FieldSpec } from "@/lib/blocks/fields";
import { deleteShippingZoneAction, saveSettingAction, saveShippingZoneAction } from "./actions";

export interface SettingsSection {
  key: string;
  label: string;
  description: string;
  isPublic: boolean;
  fields: FieldSpec[];
  values: Record<string, unknown>;
}

export interface ZoneRow {
  id?: string;
  name: string;
  districts: string[];
  is_active: boolean;
  rate_bdt: number;
  free_above_bdt: number | null;
  estimated_days: string;
}

type R = { ok: boolean; error?: string; message?: string };

function SectionForm({ section }: { section: SettingsSection }) {
  const router = useRouter();
  const [values, setValues] = useState(section.values);
  const [pending, start] = useTransition();
  return (
    <div className="bg-paper space-y-4 rounded-2xl border p-4">
      <p className="text-muted-foreground text-xs">{section.description} {section.isPublic ? "Public (read by the storefront)." : "Private (server-side only)."}</p>
      <SchemaForm fields={section.fields} values={section.values} onChange={setValues} idPrefix={`s-${section.key}`} />
      <Button className="rounded-lg" disabled={pending} onClick={() => start(async () => { const payload = section.key === "payments" && values.sslcz_store_passwd === "••••••••" ? { ...values, sslcz_store_passwd: section.values.sslcz_store_passwd } : values; const r: R = await saveSettingAction(section.key, payload); if (r.ok) { toast.success(r.message ?? "Saved"); router.refresh(); } else toast.error(r.error ?? "Failed"); })}>
        Save {section.label.toLowerCase()}
      </Button>
    </div>
  );
}

function ZonesEditor({ zones }: { zones: ZoneRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<ZoneRow[]>(zones);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<R>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? "Saved");
        router.refresh();
      } else toast.error(r.error ?? "Failed");
    });
  const upd = (i: number, patch: Partial<ZoneRow>) => setRows(rows.map((z, j) => (j === i ? { ...z, ...patch } : z)));
  return (
    <div className="bg-paper space-y-3 rounded-2xl border p-4">
      <p className="text-muted-foreground text-xs">Zones match a district list; the zone with no districts is the catch-all (Outside Dhaka). Rates in taka; the estimate is shown on the product page (PART2 §15.6).</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-left text-xs uppercase"><tr><th className="py-1">Zone</th><th className="py-1">Districts (comma-separated; blank = everywhere else)</th><th className="py-1">Rate ৳</th><th className="py-1">Free above ৳</th><th className="py-1">Estimate</th><th className="py-1">Active</th><th className="py-1" /></tr></thead>
          <tbody>
            {rows.map((z, i) => (
              <tr key={z.id ?? `new-${i}`} className="border-t align-top">
                <td className="py-2 pr-2"><Input value={z.name} onChange={(e) => upd(i, { name: e.target.value })} className="w-36 rounded-lg" aria-label="Zone name" /></td>
                <td className="py-2 pr-2"><Input value={z.districts.join(", ")} onChange={(e) => upd(i, { districts: e.target.value.split(",").map((d) => d.trim()).filter(Boolean) })} className="min-w-64 rounded-lg" aria-label="Districts" /></td>
                <td className="py-2 pr-2"><Input type="number" value={z.rate_bdt} onChange={(e) => upd(i, { rate_bdt: Number(e.target.value) })} className="w-24 rounded-lg" aria-label="Rate" /></td>
                <td className="py-2 pr-2"><Input type="number" value={z.free_above_bdt ?? ""} onChange={(e) => upd(i, { free_above_bdt: e.target.value === "" ? null : Number(e.target.value) })} className="w-24 rounded-lg" aria-label="Free above" /></td>
                <td className="py-2 pr-2"><Input value={z.estimated_days} onChange={(e) => upd(i, { estimated_days: e.target.value })} placeholder="1-2 days" className="w-28 rounded-lg" aria-label="Estimate" /></td>
                <td className="py-2 pr-2"><Switch checked={z.is_active} onCheckedChange={(v) => upd(i, { is_active: v })} aria-label="Active" /></td>
                <td className="py-2 whitespace-nowrap">
                  <Button size="sm" className="rounded-lg" disabled={pending || !z.name} onClick={() => run(() => saveShippingZoneAction(z))}>Save</Button>
                  {z.id && <Button size="sm" variant="ghost" className="text-danger rounded-lg" disabled={pending} onClick={() => confirm("Delete this zone?") && run(() => deleteShippingZoneAction(z.id!))}>Delete</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="outline" className="rounded-lg" onClick={() => setRows([...rows, { name: "", districts: [], is_active: true, rate_bdt: 100, free_above_bdt: null, estimated_days: "" }])}>Add zone</Button>
    </div>
  );
}

export function SettingsTabs({ sections, zones }: { sections: SettingsSection[]; zones: ZoneRow[] }) {
  return (
    <Tabs defaultValue={sections[0]?.key}>
      <TabsList className="mb-3 flex h-auto flex-wrap justify-start rounded-lg">
        {sections.map((s) => (
          <TabsTrigger key={s.key} value={s.key}>{s.label}</TabsTrigger>
        ))}
        <TabsTrigger value="zones">Delivery zones</TabsTrigger>
      </TabsList>
      {sections.map((s) => (
        <TabsContent key={s.key} value={s.key}>
          <SectionForm section={s} />
        </TabsContent>
      ))}
      <TabsContent value="zones">
        <ZonesEditor zones={zones} />
      </TabsContent>
    </Tabs>
  );
}
