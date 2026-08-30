import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/lib/types";

const MAP: Record<AppointmentStatus, { label: string; className: string }> = {
  booked: {
    label: "Booked",
    className: "border-transparent bg-ink text-on-ink",
  },
  completed: {
    label: "Completed",
    className: "border-hairline bg-background text-ink",
  },
  cancelled: {
    label: "Cancelled",
    className: "border-hairline bg-surface-soft text-muted-foreground",
  },
  no_show: {
    label: "No-show",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: AppointmentStatus;
  className?: string;
}) {
  const s = MAP[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 type-badge",
        s.className,
        className,
      )}
    >
      {s.label}
    </span>
  );
}
