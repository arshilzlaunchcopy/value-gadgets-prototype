"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface Hit {
  slug: string;
  title_en: string;
  price_bdt: number;
  image: { src: string; alt: string } | null;
}

/** Instant search with debounce against /api/search; Enter goes to /search?q=. */
export function SearchBox({ className = "", autoFocus = false }: { className?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        if (res.ok) {
          setHits(((await res.json()) as { items: Hit[] }).items);
          setOpen(true);
        }
      } catch {
        /* aborted or offline */
      }
    }, 250);
    return () => {
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <form
        role="search"
        action="/search"
        method="get"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) {
            setOpen(false);
            router.push(`/search?q=${encodeURIComponent(q.trim())}`);
          }
        }}
      >
        <label htmlFor="site-search" className="sr-only">
          Search products
        </label>
        <input
          id="site-search"
          name="q"
          type="search"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hits.length && setOpen(true)}
          placeholder="Search hubs, cables, chargers…"
          autoComplete="off"
          className="bg-paper text-ink focus:ring-amber w-full rounded-lg border-0 py-2 pr-10 pl-3 text-sm ring-1 ring-transparent outline-none focus:ring-2"
        />
        <button type="submit" aria-label="Search" className="text-ink/60 hover:text-ink absolute top-1/2 right-1 -translate-y-1/2 p-2">
          <Search className="size-4" />
        </button>
      </form>
      {open && hits.length > 0 && (
        <ul className="bg-paper text-ink absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-xl border shadow-lg">
          {hits.map((h) => (
            <li key={h.slug}>
              <Link href={`/products/${h.slug}`} onClick={() => setOpen(false)} className="hover:bg-accent flex items-center gap-3 px-3 py-2 text-sm">
                {/* eslint-disable-next-line @next/next/no-img-element -- tiny pre-generated thumbnail */}
                {h.image ? <img src={h.image.src} alt="" width={40} height={40} className="size-10 rounded-lg object-cover" loading="lazy" /> : <span className="bg-paper-line size-10 rounded-lg" />}
                <span className="line-clamp-1 flex-1">{h.title_en}</span>
                <span className="price text-xs">৳{h.price_bdt.toLocaleString("en-IN")}</span>
              </Link>
            </li>
          ))}
          <li>
            <Link href={`/search?q=${encodeURIComponent(q.trim())}`} onClick={() => setOpen(false)} className="text-muted-foreground hover:bg-accent block px-3 py-2 text-xs">
              See all results for &ldquo;{q.trim()}&rdquo;
            </Link>
          </li>
        </ul>
      )}
    </div>
  );
}
