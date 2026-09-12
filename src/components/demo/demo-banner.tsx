"use client";

import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { publicEnv } from "@/lib/env.public";

const KEY = "vgbd-demo-banner-dismissed";

/** Amber bar above the header (BUILD_PROMPT_PART3 §19). Dismissible per browser session. Not shown inside the admin. */
export function DemoBanner() {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (!publicEnv.demoMode) return;
    try {
      setHidden(sessionStorage.getItem(KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  if (!publicEnv.demoMode || hidden || pathname.startsWith("/admin") || pathname.startsWith("/preview")) return null;

  return (
    <div role="status" className="bg-amber text-ink relative z-50 px-4 py-2 text-center text-sm font-medium">
      Demo store: orders are simulated, no real payments or deliveries.
      <button
        type="button"
        aria-label="Dismiss demo notice"
        onClick={() => {
          try {
            sessionStorage.setItem(KEY, "1");
          } catch {}
          setHidden(true);
        }}
        className="hover:bg-amber-deep/40 absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
