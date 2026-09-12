"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface Option {
  id: string;
  label: string;
}

export function InstancePicker() {
  const router = useRouter();
  const [type, setType] = useState<"product" | "category" | "collection">("product");
  const [options, setOptions] = useState<Option[]>([]);
  const [id, setId] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/entities?type=${type}`)
      .then((r) => r.json())
      .then((j: { items: Option[] }) => alive && setOptions(j.items))
      .catch(() => alive && setOptions([]));
    return () => {
      alive = false;
    };
  }, [type]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={type} onChange={(e) => { setType(e.target.value as typeof type); setId(""); }} className="bg-paper rounded-lg border px-3 py-2 text-sm">
        <option value="product">Product</option>
        <option value="category">Category</option>
        <option value="collection">Collection</option>
      </select>
      <select value={id} onChange={(e) => setId(e.target.value)} className="bg-paper min-w-64 rounded-lg border px-3 py-2 text-sm">
        <option value="">Choose…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <Button type="button" disabled={!id} className="rounded-lg" onClick={() => router.push(`/admin/pages/${type}/${id}`)}>
        Open builder
      </Button>
    </div>
  );
}
