import { Skeleton } from "@/components/ui/skeleton";
import { timeLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Slot } from "@/lib/types";

export function TimeSlotPicker({
  slots,
  value,
  onChange,
  loading,
}: {
  slots: Slot[];
  value?: string | undefined;
  onChange: (time: string) => void;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-busy="true">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-sm" />
        ))}
      </div>
    );
  }

  const morning = slots.filter((s) => Number(s.time.slice(0, 2)) < 12);
  const afternoon = slots.filter(
    (s) => Number(s.time.slice(0, 2)) >= 12 && Number(s.time.slice(0, 2)) < 17,
  );
  const evening = slots.filter((s) => Number(s.time.slice(0, 2)) >= 17);

  const groups = [
    { label: "Morning", items: morning },
    { label: "Afternoon", items: afternoon },
    { label: "Evening", items: evening },
  ].filter((g) => g.items.length);

  return (
    <div role="radiogroup" aria-label="Available times" className="space-y-5">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-3 text-sm font-medium text-muted-foreground">{group.label}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {group.items.map((slot) => {
              const selected = slot.time === value;
              return (
                <button
                  key={slot.time}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange(slot.time)}
                  className={cn(
                    "min-h-12 rounded-sm border text-sm font-medium transition-colors",
                    selected
                      ? "border-ink bg-ink text-on-ink"
                      : "border-hairline bg-card text-ink hover:border-ink",
                  )}
                >
                  {timeLabel(slot.time)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
