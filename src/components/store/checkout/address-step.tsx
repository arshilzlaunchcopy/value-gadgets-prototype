"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { SavedAddress } from "@/app/[locale]/(store)/checkout/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addressSchema, type AddressValues } from "@/lib/checkout/schema";
import { useLocale, useT } from "@/lib/i18n/provider";

export type { AddressValues };

interface Location {
  id: string;
  name_en: string;
  name_bn: string | null;
}

async function fetchLocations(parent?: string): Promise<Location[]> {
  const res = await fetch(parent ? `/api/locations?parent=${parent}` : "/api/locations");
  return res.ok ? ((await res.json()) as { items: Location[] }).items : [];
}

/**
 * Step 2: Bangladeshi address cascade (division -> district -> upazila) from
 * bd_locations, plus street address. Delivery cost recalculates on district change.
 * Values stay English (they key shipping zones); labels follow the locale.
 */
export function AddressStep({
  defaults,
  saved,
  onDistrictChange,
  onSubmit,
  submitting,
}: {
  defaults: Partial<AddressValues>;
  saved: SavedAddress[];
  onDistrictChange: (district: string) => void;
  onSubmit: (values: AddressValues, note: string) => void;
  submitting?: boolean;
}) {
  const t = useT();
  const { locale } = useLocale();
  const name = (l: Location) => (locale === "bn" && l.name_bn) || l.name_en;
  const form = useForm<AddressValues>({ resolver: zodResolver(addressSchema), defaultValues: { area: "", postcode: "", landmark: "", ...defaults } });
  const { register, handleSubmit, setValue, watch, formState } = form;
  const [divisions, setDivisions] = useState<Location[]>([]);
  const [districts, setDistricts] = useState<Location[]>([]);
  const [upazilas, setUpazilas] = useState<Location[]>([]);
  const [note, setNote] = useState("");
  const division = watch("division");
  const district = watch("district");

  useEffect(() => {
    void fetchLocations().then(setDivisions);
  }, []);
  useEffect(() => {
    const d = divisions.find((x) => x.name_en === division);
    if (!d) return setDistricts([]);
    void fetchLocations(d.id).then(setDistricts);
  }, [division, divisions]);
  useEffect(() => {
    const d = districts.find((x) => x.name_en === district);
    if (!d) return setUpazilas([]);
    void fetchLocations(d.id).then(setUpazilas);
    if (district) onDistrictChange(district);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- notify only when the district value changes
  }, [district, districts]);

  function applySaved(a: SavedAddress) {
    setValue("recipient_name", a.recipient_name ?? "");
    setValue("phone", a.phone ?? "");
    setValue("division", a.division ?? "");
    setValue("district", a.district ?? "");
    setValue("upazila", a.upazila ?? "");
    setValue("area", a.area ?? "");
    setValue("street_address", a.street_address);
    setValue("postcode", a.postcode ?? "");
    setValue("landmark", a.landmark ?? "");
  }

  const err = (k: keyof AddressValues) => formState.errors[k]?.message;
  const field = (k: keyof AddressValues, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-1">
      <Label htmlFor={k}>{label}</Label>
      <Input id={k} {...register(k)} {...props} aria-invalid={Boolean(err(k))} className="rounded-lg" />
      {err(k) && <p className="text-danger text-xs">{err(k)}</p>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit((v) => onSubmit(v, note))} className="space-y-4" noValidate>
      <h2 className="text-lg font-semibold">{t("order.address")}</h2>

      {saved.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {saved.map((a) => (
            <button key={a.id} type="button" onClick={() => applySaved(a)} className="bg-paper hover:border-ink rounded-lg border px-3 py-1.5 text-left text-xs">
              <span className="block font-medium">{a.recipient_name}</span>
              <span className="text-muted-foreground">{[a.street_address, a.upazila, a.district].filter(Boolean).join(", ")}</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {field("recipient_name", t("checkout.recipient"), { autoComplete: "name" })}
        {field("phone", t("checkout.mobile"), { type: "tel", inputMode: "tel", placeholder: "01XXXXXXXXX", autoComplete: "tel-national" })}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="division">{t("checkout.division")}</Label>
          <select id="division" {...register("division", { onChange: () => { setValue("district", ""); setValue("upazila", ""); } })} className="bg-paper w-full rounded-lg border px-3 py-2 text-sm" aria-invalid={Boolean(err("division"))}>
            <option value="">{t("checkout.division")}</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.name_en}>
                {name(d)}
              </option>
            ))}
          </select>
          {err("division") && <p className="text-danger text-xs">{err("division")}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="district">{t("checkout.district")}</Label>
          <select id="district" {...register("district", { onChange: () => setValue("upazila", "") })} disabled={!division} className="bg-paper w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60" aria-invalid={Boolean(err("district"))}>
            <option value="">{t("checkout.district")}</option>
            {districts.map((d) => (
              <option key={d.id} value={d.name_en}>
                {name(d)}
              </option>
            ))}
          </select>
          {err("district") && <p className="text-danger text-xs">{err("district")}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="upazila">{t("checkout.upazila")}</Label>
          {upazilas.length > 0 ? (
            <select id="upazila" {...register("upazila")} className="bg-paper w-full rounded-lg border px-3 py-2 text-sm" aria-invalid={Boolean(err("upazila"))}>
              <option value="">{t("checkout.upazila")}</option>
              {upazilas.map((u) => (
                <option key={u.id} value={u.name_en}>
                  {name(u)}
                </option>
              ))}
            </select>
          ) : (
            <Input id="upazila" {...register("upazila")} placeholder={district ? `${district} Sadar` : ""} disabled={!district} aria-invalid={Boolean(err("upazila"))} className="rounded-lg" />
          )}
          {err("upazila") && <p className="text-danger text-xs">{err("upazila")}</p>}
        </div>
      </div>

      {field("street_address", t("checkout.street"), { autoComplete: "street-address" })}
      <div className="grid gap-4 sm:grid-cols-3">
        {field("area", t("checkout.area"))}
        {field("postcode", t("checkout.postcode"), { inputMode: "numeric", autoComplete: "postal-code" })}
        {field("landmark", t("checkout.landmark"))}
      </div>

      <div className="space-y-1">
        <Label htmlFor="note">{t("checkout.note")}</Label>
        <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} className="rounded-lg" rows={2} />
      </div>

      <Button type="submit" disabled={submitting} className="rounded-2xl">
        {t("checkout.continue")}
      </Button>
    </form>
  );
}
