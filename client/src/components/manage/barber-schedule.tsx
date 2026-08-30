import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DAY_NAMES } from "@/lib/format";
import type { WorkPeriod } from "@/lib/types";

export type WeekSchedule = WorkPeriod[][];

/** Recurring working hours, one row per period so a day can have a lunch gap. */
export function BarberSchedule({
  schedule,
  onChange,
}: {
  schedule: WeekSchedule;
  onChange: (next: WeekSchedule) => void;
}) {
  const update = (day: number, periods: WorkPeriod[]) =>
    onChange(schedule.map((d, i) => (i === day ? periods : d)));

  return (
    <ul className="space-y-2">
      {DAY_NAMES.map((dayName, day) => {
        const periods = schedule[day] ?? [];
        return (
          <li key={dayName} className="rounded-md border border-hairline bg-card p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <h3 className="truncate text-sm font-semibold">{dayName}</h3>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  update(day, [...periods, { start: periods.at(-1)?.end ?? "09:00", end: "18:00" }])
                }
              >
                <Plus className="size-4" aria-hidden /> Add hours
              </Button>
            </div>

            {periods.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">Not working</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {periods.map((period, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={period.start}
                      aria-label={`${dayName} period ${index + 1} start`}
                      onChange={(e) =>
                        update(
                          day,
                          periods.map((p, i) =>
                            i === index ? { ...p, start: e.target.value } : p,
                          ),
                        )
                      }
                      className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
                    />
                    <span aria-hidden className="text-muted-foreground">
                      –
                    </span>
                    <input
                      type="time"
                      value={period.end}
                      aria-label={`${dayName} period ${index + 1} end`}
                      onChange={(e) =>
                        update(
                          day,
                          periods.map((p, i) => (i === index ? { ...p, end: e.target.value } : p)),
                        )
                      }
                      className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-11 shrink-0"
                      aria-label={`Remove ${dayName} period ${index + 1}`}
                      onClick={() =>
                        update(
                          day,
                          periods.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <X className="size-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** A period is invalid if it ends before it starts or overlaps another the same day. */
export function scheduleProblem(schedule: WeekSchedule): string | null {
  for (let day = 0; day < schedule.length; day++) {
    const periods = [...(schedule[day] ?? [])].sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 0; i < periods.length; i++) {
      const period = periods[i]!;
      if (period.end <= period.start) {
        return `${DAY_NAMES[day]}: ${period.start}–${period.end} ends before it starts.`;
      }
      const next = periods[i + 1];
      if (next && next.start < period.end) {
        return `${DAY_NAMES[day]}: two periods overlap.`;
      }
    }
  }
  return null;
}
