import { Star } from "lucide-react";

export function RatingStars({ rating, count, size = 14, showCount = true, emptyLabel = "No reviews yet" }: { rating: number | null; count?: number; size?: number; showCount?: boolean; emptyLabel?: string }) {
  if (rating === null || rating === undefined || !count) {
    return showCount ? <span className="text-muted-foreground text-xs">{emptyLabel}</span> : null;
  }
  const rounded = Math.round(rating * 2) / 2;
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={`Rated ${rating} out of 5 from ${count} reviews`}>
      <span className="text-amber inline-flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} width={size} height={size} className={i <= rounded ? "fill-current" : i - 0.5 === rounded ? "fill-current opacity-60" : "opacity-30"} />
        ))}
      </span>
      {showCount && (
        <span className="text-muted-foreground text-xs tabular-nums">
          {rating.toFixed(1)} ({count})
        </span>
      )}
    </span>
  );
}
