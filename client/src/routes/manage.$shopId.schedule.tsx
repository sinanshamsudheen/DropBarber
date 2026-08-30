import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarOff, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ErrorState, ListSkeleton } from "@/components/common/states";
import { ManageHeader, RequirePermission } from "@/components/layout/manage-shell";
import {
  BarberSchedule,
  scheduleProblem,
  type WeekSchedule,
} from "@/components/manage/barber-schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addTimeOff, listBarbers, removeTimeOff, setBarberSchedule } from "@/lib/api";
import { longDate, todayISO } from "@/lib/format";
import { useSession } from "@/lib/session";

interface ScheduleSearch {
  barberId?: string | undefined;
}

export const Route = createFileRoute("/manage/$shopId/schedule")({
  validateSearch: (search: Record<string, unknown>): ScheduleSearch =>
    typeof search["barberId"] === "string" ? { barberId: search["barberId"] } : {},
  component: ScheduleRoute,
});

function ScheduleRoute() {
  const { shopId } = Route.useParams();
  return (
    <RequirePermission shopId={shopId} permission="schedule:manage">
      <SchedulePage />
    </RequirePermission>
  );
}

function SchedulePage() {
  const { shopId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { membershipFor } = useSession();
  const ownBarberId = membershipFor(shopId)?.barberId;

  const q = useQuery({ queryKey: ["barbers", shopId], queryFn: () => listBarbers(shopId) });

  // A barber manages only their own hours; owners and managers pick anyone.
  const rows = (q.data ?? []).filter((r) => !ownBarberId || r.barber.id === ownBarberId);
  const selectedId = ownBarberId ?? search.barberId ?? rows[0]?.barber.id;
  const barber = rows.find((r) => r.barber.id === selectedId)?.barber ?? null;

  const [draft, setDraft] = useState<WeekSchedule | null>(null);
  const [offDate, setOffDate] = useState("");
  const [offReason, setOffReason] = useState("");

  useEffect(() => {
    setDraft(barber ? barber.schedule.map((day) => day.map((p) => ({ ...p }))) : null);
  }, [barber]);

  const saveHours = useMutation({
    mutationFn: (next: WeekSchedule) => setBarberSchedule(selectedId!, next),
    onSuccess: () => {
      toast.success("Working hours saved");
      void queryClient.invalidateQueries({ queryKey: ["barbers", shopId] });
      void queryClient.invalidateQueries({ queryKey: ["managed-barber", shopId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createTimeOff = useMutation({
    mutationFn: () => addTimeOff(selectedId!, offDate, offReason.trim() || "Time off"),
    onSuccess: () => {
      setOffDate("");
      setOffReason("");
      toast.success("Time off added — those slots are now unavailable");
      void queryClient.invalidateQueries({ queryKey: ["barbers", shopId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTimeOff = useMutation({
    mutationFn: (id: string) => removeTimeOff(selectedId!, id),
    onSuccess: () => {
      toast.success("Time off removed");
      void queryClient.invalidateQueries({ queryKey: ["barbers", shopId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isPending) return <ListSkeleton rows={4} />;
  if (q.isError)
    return <ErrorState message={(q.error as Error).message} onRetry={() => void q.refetch()} />;

  const problem = draft ? scheduleProblem(draft) : null;

  return (
    <div>
      <ManageHeader
        title="Schedule"
        description="Recurring working hours and time off. Availability is calculated from these."
      />

      {!ownBarberId && rows.length > 1 && (
        <Select
          value={selectedId ?? ""}
          onValueChange={(barberId) =>
            void navigate({
              to: "/manage/$shopId/schedule",
              params: { shopId },
              search: { barberId },
            })
          }
        >
          <SelectTrigger className="h-11" aria-label="Choose a barber">
            <SelectValue placeholder="Choose a barber" />
          </SelectTrigger>
          <SelectContent>
            {rows.map((r) => (
              <SelectItem key={r.barber.id} value={r.barber.id}>
                {r.barber.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {!barber || !draft ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Add a barber before setting working hours.
        </p>
      ) : (
        <div className="mt-5 space-y-6">
          <section>
            <h2 className="text-base font-semibold">Weekly hours for {barber.name}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Add a second period on a day to leave a lunch break out of the booking grid.
            </p>
            <div className="mt-3">
              <BarberSchedule schedule={draft} onChange={setDraft} />
            </div>
            {problem && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {problem}
              </p>
            )}
            <Button
              className="mt-4 h-12 w-full rounded-xl sm:w-auto"
              disabled={!!problem || saveHours.isPending}
              onClick={() => saveHours.mutate(draft)}
            >
              {saveHours.isPending ? "Saving…" : "Save working hours"}
            </Button>
          </section>

          <section>
            <h2 className="text-base font-semibold">Time off</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Days off, leave or anything else that should stop bookings.
            </p>

            <div className="mt-3 rounded-2xl border border-border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="off-date">Date</Label>
                  <Input
                    id="off-date"
                    type="date"
                    min={todayISO()}
                    value={offDate}
                    onChange={(e) => setOffDate(e.target.value)}
                    className="mt-1.5 h-11"
                  />
                </div>
                <div>
                  <Label htmlFor="off-reason">Reason</Label>
                  <Input
                    id="off-reason"
                    value={offReason}
                    onChange={(e) => setOffReason(e.target.value)}
                    placeholder="e.g. Family wedding"
                    className="mt-1.5 h-11"
                  />
                </div>
              </div>
              <Button
                size="sm"
                className="mt-3"
                disabled={!offDate || createTimeOff.isPending}
                onClick={() => createTimeOff.mutate()}
              >
                <Plus className="size-4" aria-hidden />
                {createTimeOff.isPending ? "Adding…" : "Add time off"}
              </Button>
            </div>

            {barber.timeOff.length === 0 ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarOff className="size-4" aria-hidden /> No time off booked.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {[...barber.timeOff]
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((t) => (
                    <li
                      key={t.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-card p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{longDate(t.date)}</p>
                        <p className="truncate text-xs text-muted-foreground">{t.reason}</p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-11"
                        aria-label={`Remove time off on ${longDate(t.date)}`}
                        disabled={deleteTimeOff.isPending}
                        onClick={() => deleteTimeOff.mutate(t.id)}
                      >
                        <X className="size-4" aria-hidden />
                      </Button>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
