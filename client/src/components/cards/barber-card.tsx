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
    <Avatar className={cn("size-12", className)}>
      {barber.photo && <AvatarImage src={barber.photo} alt={barber.name} />}
      <AvatarFallback className="bg-secondary font-display text-secondary-foreground">
        {initials(barber.name)}
      </AvatarFallback>
    </Avatar>
  );
}

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
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
      <BarberAvatar barber={barber} />
      <div className="min-w-0 text-left">
        <p className="truncate text-sm font-semibold">{barber.name}</p>
        <p className="line-clamp-1 text-xs text-muted-foreground">{barber.bio}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Rating value={barber.rating} count={barber.reviewCount} />
          {durationMin != null && (
            <span className="text-xs font-medium text-muted-foreground">{duration(durationMin)}</span>
          )}
          {price != null && <span className="text-xs font-semibold">{money(price)}</span>}
        </div>
      </div>
      {onSelect && (
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-full border",
            selected ? "border-accent bg-accent text-accent-foreground" : "border-border",
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
          "w-full rounded-2xl border bg-card p-3.5 text-left transition-colors",
          selected ? "border-accent ring-1 ring-accent" : "border-border hover:border-accent/50",
        )}
      >
        {body}
      </button>
    );
  }
  return <div className="rounded-2xl border border-border bg-card p-3.5">{body}</div>;
}
