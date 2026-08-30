import { Link } from "@tanstack/react-router";
import { CalendarDays, Clock, ImageIcon, MapPin } from "lucide-react";
import { StatusBadge } from "@/components/common/status-badge";
import type { HydratedAppointment } from "@/lib/api";
import { dayLabel, money, timeLabel } from "@/lib/format";

export function AppointmentCard({ appointment }: { appointment: HydratedAppointment }) {
  return (
    <Link
      to="/bookings/$appointmentId"
      params={{ appointmentId: appointment.id }}
      className="block rounded-md border border-hairline bg-card p-5 transition-shadow hover:shadow-float"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h3 className="type-title-md truncate text-ink">{appointment.shop.name}</h3>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {appointment.service.name} with {appointment.barber.name}
          </p>
        </div>
        <StatusBadge status={appointment.status} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-3.5" aria-hidden /> {dayLabel(appointment.date)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3.5" aria-hidden /> {timeLabel(appointment.time)} ·{" "}
          {appointment.durationMin} min
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-3.5" aria-hidden /> {appointment.shop.area}
        </span>
        {appointment.referencePhotos.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-brand">
            <ImageIcon className="size-3.5" aria-hidden /> {appointment.referencePhotos.length}{" "}
            reference
          </span>
        )}
        <span className="ms-auto font-semibold text-ink">
          {money(appointment.completion?.finalPrice ?? appointment.price)}
        </span>
      </div>
    </Link>
  );
}
