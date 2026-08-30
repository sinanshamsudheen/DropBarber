import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarPlus, Clock, Users } from "lucide-react";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { ManageHeader } from "@/components/layout/manage-shell";
import { Button } from "@/components/ui/button";
import { getShopDay } from "@/lib/api";
import { longDate, money, timeLabel, todayISO } from "@/lib/format";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/manage/$shopId/")({
  component: TodayDashboard,
});

function TodayDashboard() {
  const { shopId } = Route.useParams();
  const { membershipFor } = useSession();
  const membership = membershipFor(shopId);
  const q = useQuery({ queryKey: ["shop-day", shopId], queryFn: () => getShopDay(shopId) });

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const mine = (barberId: string) => !membership?.barberId || membership.barberId === barberId;

  const appointments = (q.data?.appointments ?? []).filter((a) => mine(a.barberId));
  const next = appointments.find(
    (a) => a.status === "booked" && Number(a.time.slice(0, 2)) * 60 + Number(a.time.slice(3)) >= nowMin - 15,
  );

  return (
    <div>
      <ManageHeader
        title="Today"
        description={longDate(todayISO())}
        action={
          <Button asChild size="sm" variant="outline">
            <Link to="/manage/$shopId/appointments" params={{ shopId }} search={{ date: todayISO() }}>
              All appointments
            </Link>
          </Button>
        }
      />

      {q.isPending && <ListSkeleton rows={3} />}
      {q.isError && <ErrorState message={(q.error as Error).message} onRetry={() => void q.refetch()} />}

      {q.data && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Appointments today" value={String(appointments.length)} />
            <Stat
              label="Completed"
              value={String(appointments.filter((a) => a.status === "completed").length)}
            />
            <Stat
              label="Expected revenue"
              value={money(
                appointments
                  .filter((a) => a.status !== "cancelled" && a.status !== "no_show")
                  .reduce((s, a) => s + (a.completion?.finalPrice ?? a.price), 0),
              )}
            />
          </div>

          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Next appointment
            </h2>
            {next ? (
              <Link
                to="/manage/$shopId/appointments/$appointmentId"
                params={{ shopId, appointmentId: next.id }}
                className="block rounded-2xl border border-accent/40 bg-accent/8 p-4 transition-colors hover:border-accent"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold">
                      {timeLabel(next.time)} · {next.customer.name}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {next.service.name} with {next.barber.name} · {next.durationMin} min
                    </p>
                  </div>
                  <StatusBadge status={next.status} />
                </div>
                {next.note && <p className="mt-2 text-sm">“{next.note}”</p>}
                {next.referencePhotos.length > 0 && (
                  <p className="mt-2 text-xs font-medium text-accent">
                    {next.referencePhotos.length} reference photo attached
                  </p>
                )}
              </Link>
            ) : (
              <EmptyState
                icon={Clock}
                title="Nothing else booked today"
                description="Enjoy the quiet, or check the week ahead."
              />
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Rest of today
            </h2>
            {appointments.length === 0 ? (
              <EmptyState
                icon={CalendarPlus}
                title="No appointments today"
                description="New bookings appear here the moment a customer books."
              />
            ) : (
              <ul className="space-y-2">
                {appointments.map((a) => (
                  <li key={a.id}>
                    <Link
                      to="/manage/$shopId/appointments/$appointmentId"
                      params={{ shopId, appointmentId: a.id }}
                      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-accent/50"
                    >
                      <span className="w-16 shrink-0 text-sm font-semibold">{timeLabel(a.time)}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{a.customer.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {a.service.name} · {a.barber.name}
                        </span>
                      </span>
                      <StatusBadge status={a.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Barbers today
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {q.data.barbers.map((b) => (
                <li
                  key={b.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{b.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {!b.active
                        ? "Inactive"
                        : b.working
                          ? b.periods.map((p) => `${p.start}–${p.end}`).join(", ")
                          : "Not working today"}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="size-3.5" aria-hidden /> {b.todayCount}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
