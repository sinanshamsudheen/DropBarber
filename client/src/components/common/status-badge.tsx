import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/lib/types";

const MAP: Record<AppointmentStatus, { label: string; className: string }> = {
  booked: { label: "Booked", className: "bg-accent/12 text-accent border-accent/30" },
  completed: { label: "Completed", className: "bg-success/12 text-success border-success/30" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground border-border" },
  no_show: { label: "No-show", className: "bg-destructive/10 text-destructive border-destructive/25" },
};

export function StatusBadge({ status, className }: { status: AppointmentStatus; className?: string }) {
  const s = MAP[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
        s.className,
        className,
      )}
    >
      {s.label}
    </span>
  );
}
