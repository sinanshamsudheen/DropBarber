import { format, parseISO } from "date-fns";
import { addDaysISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export function DateStrip({
  value,
  onChange,
  days = 14,
}: {
  value: string;
  onChange: (date: string) => void;
  days?: number;
}) {
  const dates = Array.from({ length: days }, (_, i) => addDaysISO(i));
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1">
      <div role="radiogroup" aria-label="Choose a date" className="flex gap-2">
        {dates.map((d) => {
          const parsed = parseISO(d);
          const selected = d === value;
          return (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(d)}
              className={cn(
                "flex min-h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl border text-sm transition-colors",
                selected
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border bg-card hover:border-accent/50",
              )}
            >
              <span className="text-[11px] uppercase tracking-wide opacity-80">{format(parsed, "EEE")}</span>
              <span className="text-lg font-semibold leading-tight">{format(parsed, "d")}</span>
              <span className="text-[11px] opacity-80">{format(parsed, "MMM")}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
