"use client";

import { SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { publicEnv } from "@/lib/env.public";

/** Floating bottom-right button to the /demo control panel (BUILD_PROMPT_PART3 §22). */
export function DemoLauncher() {
  const pathname = usePathname();
  if (!publicEnv.demoMode || pathname.startsWith("/demo")) return null;
  return (
    <Link
      href="/demo"
      className="bg-ink text-amber ring-amber/40 hover:ring-amber fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg ring-2 transition"
    >
      <SlidersHorizontal className="size-4" />
      Demo panel
    </Link>
  );
}
