import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarX } from "lucide-react";
import { DateStrip } from "@/components/booking/date-strip";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { ManageHeader } from "@/components/layout/manage-shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listBarbers, listShopAppointments } from "@/lib/api";
import { longDate, money, timeLabel, todayISO } from "@/lib/format";
import type { AppointmentStatus } from "@/lib/types";

interface Search {
  date?: string | undefined;
  barberId?: string | undefined;
  status?: string | undefined;
}

export const Route = createFileRoute("/manage/$shopId/appointments/")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const out: Search = {};
    if (typeof search["date"] === "string") out.date = search["date"];
    if (typeof search["barberId"] === "string") out.barberId = search["barberId"];
    if (typeof search["status"] === "string") out.status = search["status"];
    return out;
  },
  component: AppointmentsPage,
});

const STATUSES: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "booked", label: "Booked" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
];

function AppointmentsPage() {
  const { shopId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const date = search.date ?? todayISO();

  const setSearch = (patch: Partial<Search>) =>
    void navigate({
      to: "/manage/$shopId/appointments",
      params: { shopId },
      search: { ...search, ...patch },
    });

  const barbersQuery = useQuery({ queryKey: ["barbers", shopId], queryFn: () => listBarbers(shopId) });
  const q = useQuery({
    queryKey: ["shop-appointments", shopId, date],
    queryFn: () => listShopAppointments(shopId, date),
  });

  const rows = (q.data ?? []).filter(
    (a) =>
      (!search.barberId || search.barberId === "all" || a.barberId === search.barberId) &&
      (!search.status || search.status === "all" || a.status === (search.status as AppointmentStatus)),
  );

  return (
    <div>
      <ManageHeader title="Appointments" description={longDate(date)} />

      <DateStrip value={date} onChange={(d) => setSearch({ date: d })} days={21} />

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Select value={search.barberId ?? "all"} onValueChange={(v) => setSearch({ barberId: v })}>
          <SelectTrigger aria-label="Filter by barber">
            <SelectValue placeholder="All barbers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All barbers</SelectItem>
            {barbersQuery.data?.map((b) => (
              <SelectItem key={b.barber.id} value={b.barber.id}>
                {b.barber.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={search.status ?? "all"} onValueChange={(v) => setSearch({ status: v })}>
          <SelectTrigger aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-5">
        {q.isPending && <ListSkeleton rows={4} />}
        {q.isError && <ErrorState message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
        {q.isSuccess && rows.length === 0 && (
          <EmptyState
            icon={CalendarX}
            title="No appointments match this day and filter"
            description="Try another date, barber or status."
          />
        )}
        <ul className="space-y-2">
          {rows.map((a) => (
            <li key={a.id}>
              <Link
                to="/manage/$shopId/appointments/$appointmentId"
                params={{ shopId, appointmentId: a.id }}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-accent/50"
              >
                <span className="w-16 shrink-0">
                  <span className="block text-sm font-semibold">{timeLabel(a.time)}</span>
                  <span className="block text-[11px] text-muted-foreground">{a.durationMin}m</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{a.customer.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {a.service.name} · {a.barber.name} · {money(a.completion?.finalPrice ?? a.price)}
                  </span>
                </span>
                <StatusBadge status={a.status} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
