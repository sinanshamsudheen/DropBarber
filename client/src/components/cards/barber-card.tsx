import { Check } from "lucide-react";
import { Rating } from "@/components/common/rating";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { duration, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Barber } from "@/lib/types";

export const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

export function BarberAvatar({ barber, className }: { barber: Barber; className?: string }) {
  return (
    <Avatar className={cn("size-14", className)}>
      {barber.photo && <AvatarImage src={barber.photo} alt={barber.name} />}
      <AvatarFallback>{initials(barber.name)}</AvatarFallback>
    </Avatar>
  );
}

/*
 * Selectable rows use an ink outline rather than a Rausch one — Rausch is
 * reserved for CTAs and the save state, so selection reads as a 2px ink ring on
 * a soft surface, matching the date-picker-day-selected treatment.
 */
export function BarberCard({
  barber,
  durationMin,
  price,
  selected,
  onSelect,
  href,
}: {
  barber: Barber;
  durationMin?: number | null;
  price?: number | null;
  selected?: boolean;
  onSelect?: () => void;
  href?: React.ReactNode;
}) {
  const body = (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4">
      <BarberAvatar barber={barber} />
      <div className="min-w-0 text-left">
        <p className="type-title-md truncate text-ink">{barber.name}</p>
        <p className="line-clamp-1 text-sm text-muted-foreground">{barber.bio}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Rating value={barber.rating} count={barber.reviewCount} />
          {durationMin != null && (
            <span className="text-sm text-muted-foreground">{duration(durationMin)}</span>
          )}
          {price != null && <span className="text-sm font-semibold text-ink">{money(price)}</span>}
        </div>
      </div>
      {onSelect && (
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-full border",
            selected ? "border-ink bg-ink text-white" : "border-border-strong",
          )}
          aria-hidden
        >
          {selected && <Check className="size-4" />}
        </span>
      )}
      {href}
    </div>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "w-full rounded-md border bg-card p-4 text-left transition-colors",
          selected
            ? "border-ink bg-surface-soft ring-1 ring-ink"
            : "border-hairline hover:border-ink",
        )}
      >
        {body}
      </button>
    );
  }
  return <div className="rounded-md border border-hairline bg-card p-4">{body}</div>;
}
