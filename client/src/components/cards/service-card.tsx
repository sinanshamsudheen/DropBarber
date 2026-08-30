import { Check, ChevronRight } from "lucide-react";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Service } from "@/lib/types";

export function ServiceCard({
  service,
  durationHint,
  selected,
  onSelect,
}: {
  service: Service;
  durationHint?: string;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const Wrapper = onSelect ? "button" : "div";
  return (
    <Wrapper
      {...(onSelect ? { type: "button" as const, onClick: onSelect, "aria-pressed": selected } : {})}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left transition-colors",
        selected ? "border-accent ring-1 ring-accent" : "border-border",
        onSelect && "hover:border-accent/50",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{service.name}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{service.description}</p>
        {durationHint && <p className="mt-1.5 text-xs font-medium text-accent">{durationHint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-semibold">{money(service.price)}</span>
        {onSelect &&
          (selected ? (
            <span className="grid size-6 place-items-center rounded-full bg-accent text-accent-foreground">
              <Check className="size-4" aria-hidden />
            </span>
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          ))}
      </div>
    </Wrapper>
  );
}
