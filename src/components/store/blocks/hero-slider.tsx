"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { z } from "zod";
import type { heroSliderSchema } from "@/lib/blocks/types/hero-slider";

type Settings = z.output<typeof heroSliderSchema>;

/** Client island: first slide is server-rendered; autoplay/dots run in the browser. */
export function HeroSlider({ settings, locale }: { settings: Settings; locale: "en" | "bn" }) {
  const { slides, autoplay_ms, show_dots } = settings;
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!autoplay_ms || slides.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), autoplay_ms);
    return () => clearInterval(t);
  }, [autoplay_ms, slides.length]);
  const s = slides[i] ?? slides[0];
  if (!s) return null;
  const heading = (locale === "bn" && s.heading_bn) || s.heading_en;
  const align = s.text_position === "center" ? "items-center text-center" : s.text_position === "right" ? "items-end text-right" : "items-start text-left";

  return (
    <div className="bg-ink text-paper relative overflow-hidden rounded-2xl" aria-roledescription="carousel">
      <div className="relative aspect-[16/9] sm:aspect-[8/3]">
        {s.image_desktop ? (
          <picture>
            {s.image_mobile && <source media="(max-width: 640px)" srcSet={s.image_mobile} />}
            <img src={s.image_desktop} alt={s.alt_text} className="absolute inset-0 h-full w-full object-cover" loading={i === 0 ? "eager" : "lazy"} fetchPriority={i === 0 ? "high" : "auto"} />
          </picture>
        ) : (
          <div className="bg-gradient-brand absolute inset-0 opacity-30" aria-hidden="true" />
        )}
        <div className="from-ink/80 absolute inset-0 bg-gradient-to-r to-transparent" aria-hidden="true" />
        <div className={`absolute inset-0 flex flex-col justify-end gap-3 p-6 sm:p-10 ${align}`}>
          {heading && <h2 className="max-w-xl text-2xl font-semibold leading-tight sm:text-4xl">{heading}</h2>}
          {s.subheading_en && <p className="text-paper/85 max-w-lg text-sm sm:text-base">{s.subheading_en}</p>}
          {s.cta_label_en && s.cta_href && (
            <Link href={s.cta_href} className="bg-amber text-ink hover:bg-amber-lite inline-flex w-fit items-center rounded-2xl px-5 py-2.5 text-sm font-semibold">
              {s.cta_label_en}
            </Link>
          )}
        </div>
      </div>
      {show_dots && slides.length > 1 && (
        <div className="absolute right-4 bottom-4 flex gap-1.5">
          {slides.map((_, k) => (
            <button key={k} type="button" aria-label={`Slide ${k + 1}`} aria-current={k === i} onClick={() => setI(k)} className={`h-2 rounded-full transition-all ${k === i ? "bg-amber w-6" : "bg-paper/50 w-2"}`} />
          ))}
        </div>
      )}
    </div>
  );
}
