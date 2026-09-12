"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Announcement } from "@/lib/theme/schema";

const KEY = "vgbd-announcement-dismissed";

/** Announcement bar (PART2 §13.4). Schedule is checked on the server; dismissal is per browser. */
export function AnnouncementBar({ a, locale = "en" }: { a: Announcement; locale?: "en" | "bn" }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      if (a.dismissible && sessionStorage.getItem(KEY) === a.text_en) setHidden(true);
    } catch {}
  }, [a.dismissible, a.text_en]);
  if (hidden) return null;
  const text = (locale === "bn" && a.text_bn) || a.text_en;
  const inner = <span className="text-sm font-medium">{text}</span>;
  return (
    <div className="relative px-10 py-1.5 text-center" style={{ backgroundColor: a.background_color, color: a.text_color }} role="region" aria-label="Announcement">
      {a.href ? (
        <Link href={a.href} className="underline-offset-2 hover:underline">
          {inner}
        </Link>
      ) : (
        inner
      )}
      {a.dismissible && (
        <button
          type="button"
          aria-label="Dismiss announcement"
          onClick={() => {
            try {
              sessionStorage.setItem(KEY, a.text_en);
            } catch {}
            setHidden(true);
          }}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 opacity-70 hover:opacity-100"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
