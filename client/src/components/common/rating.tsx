import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * DESIGN.md star-rating resolves to the ink token, not a gold: yellow stars read
 * cheap in a marketplace context, so the star and the number both render in ink.
 */
export function Rating({
  value,
  count,
  size = "sm",
  className,
}: {
  value: number;
  count?: number | undefined;
  size?: "sm" | "md";
  className?: string;
}) {
  if (!value) {
    return <span className={cn("text-sm text-muted-foreground", className)}>No ratings yet</span>;
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-ink",
        size === "sm" ? "text-sm" : "text-base",
        className,
      )}
      aria-label={`Rated ${value.toFixed(1)} out of 5${count ? ` from ${count} reviews` : ""}`}
    >
      <Star
        className={cn("fill-ink text-ink", size === "sm" ? "size-3.5" : "size-4")}
        aria-hidden
      />
      <span className="font-medium">{value.toFixed(1)}</span>
      {count !== undefined && <span className="text-muted-foreground">({count})</span>}
    </span>
  );
}

/*
 * The listing-detail rating display — a 64px/700 number flanked by laurel
 * ornaments. The single typographically loud moment in the whole system.
 */
export function RatingDisplay({
  value,
  caption,
  className,
}: {
  value: number;
  caption?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center text-center text-ink", className)}>
      <div className="flex items-center gap-2">
        <Laurel className="h-14 w-6" />
        <span className="type-rating-display">{value.toFixed(2)}</span>
        <Laurel className="h-14 w-6 -scale-x-100" />
      </div>
      {caption && <p className="type-title-md mt-1">{caption}</p>}
    </div>
  );
}

function Laurel({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 60" fill="none" className={className} aria-hidden>
      <path
        d="M20 2C10 8 4 20 4 32c0 10 4 20 12 26"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {[8, 16, 24, 32, 40, 47].map((y, i) => (
        <path key={y} d={`M${13 - i * 0.8} ${y}c-4-2-7-1-9 2 3 2 7 2 9-2Z`} fill="currentColor" />
      ))}
    </svg>
  );
}

export function StarInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
          onClick={() => onChange(star)}
          className="grid size-11 place-items-center rounded-full transition-colors hover:bg-surface-soft"
        >
          <Star
            className={cn(
              "size-7 transition-colors",
              star <= value ? "fill-amber text-amber" : "text-border-strong",
            )}
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
}
