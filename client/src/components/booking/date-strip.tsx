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
    <div className="-mx-6 overflow-x-auto px-6 pb-1">
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
                "flex min-h-[72px] w-[72px] shrink-0 flex-col items-center justify-center rounded-md border text-sm transition-colors",
                selected
                  ? "border-ink bg-ink text-on-ink"
                  : "border-hairline bg-card text-ink hover:border-ink",
              )}
            >
              <span className="text-[11px] font-medium uppercase tracking-wide opacity-70">
                {format(parsed, "EEE")}
              </span>
              <span className="text-xl font-semibold leading-tight">{format(parsed, "d")}</span>
              <span className="text-[11px] opacity-70">{format(parsed, "MMM")}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
