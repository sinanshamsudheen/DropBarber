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
      {...(onSelect
        ? {
            type: "button" as const,
            onClick: onSelect,
            "aria-pressed": selected,
          }
        : {})}
      className={cn(
        "flex w-full items-center gap-4 rounded-md border bg-card p-4 text-left transition-colors sm:p-5 md:p-6",
        selected ? "border-ink bg-surface-soft ring-1 ring-ink" : "border-hairline",
        onSelect && !selected && "hover:border-ink",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="type-title-md truncate text-ink">{service.name}</p>
        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{service.description}</p>
        {durationHint && <p className="mt-1.5 text-sm text-muted-foreground">{durationHint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-base font-semibold text-ink">{money(service.price)}</span>
        {onSelect &&
          (selected ? (
            <span className="grid size-6 place-items-center rounded-full bg-ink text-on-ink">
              <Check className="size-4" aria-hidden />
            </span>
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          ))}
      </div>
    </Wrapper>
  );
}
