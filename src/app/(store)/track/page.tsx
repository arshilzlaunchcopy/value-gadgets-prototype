import type { Metadata } from "next";
import { TrackForm } from "@/components/store/track-form";

export const metadata: Metadata = { title: "Track your order", alternates: { canonical: "/track" } };

export default async function TrackPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const order = typeof sp.order === "string" ? sp.order : "";
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-2xl font-semibold sm:text-3xl">Track your order</h1>
      <p className="text-muted-foreground mb-6 text-sm">Enter the mobile number you ordered with and your order number. No login needed.</p>
      <TrackForm initialOrder={order} />
    </div>
  );
}
