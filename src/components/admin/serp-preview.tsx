"use client";

/**
 * Live SERP preview with pixel-width warnings (BUILD_PROMPT §7.2). Google cuts
 * titles at ~600 px and descriptions at ~920 px on desktop; characters are a
 * poor proxy because "W" and "i" differ threefold.
 */
export function textWidth(text: string, font: string): number {
  if (typeof document === "undefined") return text.length * 7;
  const holder = textWidth as unknown as { canvas?: HTMLCanvasElement };
  const c = holder.canvas ?? (holder.canvas = document.createElement("canvas"));
  const ctx = c.getContext("2d");
  if (!ctx) return text.length * 7;
  ctx.font = font;
  return ctx.measureText(text).width;
}

export const TITLE_MAX_PX = 600;
export const DESC_MAX_PX = 920;

export function SerpPreview({ title, description, url }: { title: string; description: string; url: string }) {
  const titlePx = Math.round(textWidth(title, "20px Arial"));
  const descPx = Math.round(textWidth(description, "14px Arial"));
  return (
    <div className="bg-paper rounded-2xl border p-4">
      <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase">Live SERP preview</p>
      <p className="truncate text-xs text-[#202124]">{url}</p>
      <p className="mt-0.5 truncate text-[20px] leading-tight text-[#1a0dab]" style={{ fontFamily: "Arial, sans-serif" }}>{title || "Title"}</p>
      <p className="mt-1 line-clamp-2 text-[14px] text-[#4d5156]" style={{ fontFamily: "Arial, sans-serif" }}>{description || "Description"}</p>
      <p className={`mt-2 text-xs ${titlePx > TITLE_MAX_PX ? "text-danger" : "text-muted-foreground"}`}>
        Title {titlePx}px / {TITLE_MAX_PX}px{titlePx > TITLE_MAX_PX ? " - will be truncated" : ""}
      </p>
      <p className={`text-xs ${descPx > DESC_MAX_PX ? "text-danger" : "text-muted-foreground"}`}>
        Description {descPx}px / {DESC_MAX_PX}px{descPx > DESC_MAX_PX ? " - will be truncated" : ""}
      </p>
    </div>
  );
}
