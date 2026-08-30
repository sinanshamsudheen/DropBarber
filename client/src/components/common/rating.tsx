import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

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
    return <span className={cn("text-xs text-muted-foreground", className)}>No ratings yet</span>;
  }
  return (
    <span
      className={cn("inline-flex items-center gap-1 font-medium", size === "sm" ? "text-xs" : "text-sm", className)}
      aria-label={`Rated ${value.toFixed(1)} out of 5${count ? ` from ${count} reviews` : ""}`}
    >
      <Star className={cn("fill-accent text-accent", size === "sm" ? "size-3.5" : "size-4")} aria-hidden />
      {value.toFixed(1)}
      {count !== undefined && <span className="font-normal text-muted-foreground">({count})</span>}
    </span>
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
          className="grid size-11 place-items-center rounded-full transition-colors hover:bg-secondary"
        >
          <Star
            className={cn("size-7 transition-colors", star <= value ? "fill-accent text-accent" : "text-border")}
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
}
