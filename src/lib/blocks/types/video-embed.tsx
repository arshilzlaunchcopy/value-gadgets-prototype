import { z } from "zod";
import { defineBlock } from "../define";

const schema = z.object({
  video_url: z.string().max(500).describe("YouTube or Facebook video URL"),
  title_en: z.string().max(120).optional().or(z.literal("")),
  caption_en: z.string().max(240).optional().or(z.literal("")),
  aspect: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  width: z.enum(["narrow", "wide"]).default("wide"),
});

/** Turn a share URL into a privacy-friendly embed URL; null when unsupported. */
export function embedSrc(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = u.searchParams.get("v") ?? (u.pathname.startsWith("/shorts/") ? u.pathname.split("/")[2] : u.pathname.startsWith("/embed/") ? u.pathname.split("/")[2] : null);
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === "facebook.com" || host === "fb.watch" || host === "m.facebook.com") return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`;
    return null;
  } catch {
    return null;
  }
}

export default defineBlock({
  type: "video_embed",
  label: "Video embed",
  icon: "Play",
  description: "YouTube or Facebook video, lazy-loaded.",
  allowedOn: ["home", "product", "category", "collection", "page", "landing", "custom"],
  schema,
  defaults: { video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title_en: "See it in action", caption_en: "", aspect: "16:9", width: "wide" },
  component: ({ settings }) => {
    const src = embedSrc(settings.video_url);
    const ratio = { "16:9": "aspect-video", "9:16": "aspect-[9/16] max-w-sm mx-auto", "1:1": "aspect-square max-w-xl mx-auto" }[settings.aspect];
    return (
      <div className={settings.width === "narrow" ? "mx-auto max-w-2xl" : ""}>
        {settings.title_en && <h2 className="mb-3 text-xl font-semibold sm:text-2xl">{settings.title_en}</h2>}
        <div className={`bg-ink overflow-hidden rounded-2xl ${ratio}`}>
          {src ? (
            <iframe src={src} title={settings.title_en || "Video"} className="h-full w-full" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          ) : (
            <p className="text-paper/70 grid h-full place-items-center text-sm">Unsupported video URL</p>
          )}
        </div>
        {settings.caption_en && <p className="text-muted-foreground mt-2 text-center text-xs">{settings.caption_en}</p>}
      </div>
    );
  },
});
