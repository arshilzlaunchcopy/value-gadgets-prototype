"use client";

import { useEffect, useState } from "react";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** Live countdown; renders the server's value first so there is no layout shift. */
export function CountdownTimer({ endsAt }: { endsAt: string }) {
  const end = new Date(endsAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const p = parts(end - now);
  const over = end - now <= 0;
  const cell = (v: number, label: string) => (
    <span className="bg-paper/10 flex min-w-14 flex-col items-center rounded-lg px-2 py-1.5">
      <span className="text-xl font-bold tabular-nums">{String(v).padStart(2, "0")}</span>
      <span className="text-paper/60 text-[10px] uppercase">{label}</span>
    </span>
  );
  return (
    <div className="flex items-center gap-1.5" role="timer" aria-live="off" aria-label={over ? "Deal ended" : `${p.d} days ${p.h} hours ${p.m} minutes left`}>
      {over ? <span className="text-amber text-sm font-semibold">Deal ended</span> : <>{p.d > 0 && cell(p.d, "days")}{cell(p.h, "hrs")}{cell(p.m, "min")}{cell(p.s, "sec")}</>}
    </div>
  );
}
