import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarOff, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ErrorState, ListSkeleton } from "@/components/common/states";
import {
  ManageHeader,
  RequirePermission,
} from "@/components/layout/manage-shell";
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
import { useBarberSchedule } from "@/hooks/use-barber-schedule";
import { useShopBarbers } from "@/hooks/use-shop-barbers";
import { createTimeOffApiV1ShopsShopIdBarbersBarberIdTimeOffPost } from "@/lib/api/generated/clients/createTimeOffApiV1ShopsShopIdBarbersBarberIdTimeOffPost";
import { deleteTimeOffApiV1ShopsShopIdBarbersBarberIdTimeOffTimeOffIdDelete } from "@/lib/api/generated/clients/deleteTimeOffApiV1ShopsShopIdBarbersBarberIdTimeOffTimeOffIdDelete";
import { setWorkingHoursApiV1ShopsShopIdBarbersBarberIdWorkingHoursPut } from "@/lib/api/generated/clients/setWorkingHoursApiV1ShopsShopIdBarbersBarberIdWorkingHoursPut";
import { getScheduleApiV1ShopsShopIdBarbersBarberIdScheduleGetQueryKey } from "@/lib/api/generated/hooks/useGetScheduleApiV1ShopsShopIdBarbersBarberIdScheduleGet";
import { listShopBarbersApiV1ShopsShopIdBarbersGetQueryKey } from "@/lib/api/generated/hooks/useListShopBarbersApiV1ShopsShopIdBarbersGet";
import { getErrorMessage } from "@/lib/api-client";
import { frontendDayToBackend } from "@/lib/domain-mappers";
import { longDate, todayISO } from "@/lib/format";
import { useSession } from "@/lib/session";

interface ScheduleSearch {
  barberId?: string | undefined;
}

export const Route = createFileRoute("/manage/$shopId/schedule")({
  validateSearch: (search: Record<string, unknown>): ScheduleSearch =>
    typeof search["barberId"] === "string"
      ? { barberId: search["barberId"] }
      : {},
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

  const q = useShopBarbers(shopId);

  // A barber manages only their own hours; owners and managers pick anyone.
  const rows = (q.data ?? []).filter(
    (r) => !ownBarberId || r.barber.id === ownBarberId,
  );
  const selectedId = ownBarberId ?? search.barberId ?? rows[0]?.barber.id;
  const barber = rows.find((r) => r.barber.id === selectedId)?.barber ?? null;

  const scheduleQuery = useBarberSchedule(shopId, selectedId);
  const timeOff = scheduleQuery.data?.timeOff ?? [];

  const [draft, setDraft] = useState<WeekSchedule | null>(null);
  const [offDate, setOffDate] = useState("");
  const [offReason, setOffReason] = useState("");

  useEffect(() => {
    setDraft(
      scheduleQuery.data
        ? scheduleQuery.data.schedule.map((day) => day.map((p) => ({ ...p })))
        : null,
    );
  }, [scheduleQuery.data]);

  const invalidateSchedule = () =>
    queryClient.invalidateQueries({
      queryKey: getScheduleApiV1ShopsShopIdBarbersBarberIdScheduleGetQueryKey({
        path: { shop_id: shopId, barber_id: selectedId ?? "" },
      }),
    });

  const saveHours = useMutation({
    mutationFn: (next: WeekSchedule) => {
      const periods = next.flatMap((dayPeriods, frontendDay) =>
        dayPeriods.map((p) => ({
          day_of_week: frontendDayToBackend(frontendDay),
          start_time: `${p.start}:00`,
          end_time: `${p.end}:00`,
          is_active: true,
        })),
      );
      return setWorkingHoursApiV1ShopsShopIdBarbersBarberIdWorkingHoursPut({
        path: { shop_id: shopId, barber_id: selectedId! },
        body: periods,
      });
    },
    onSuccess: () => {
      toast.success("Working hours saved");
      void queryClient.invalidateQueries({
        queryKey: listShopBarbersApiV1ShopsShopIdBarbersGetQueryKey({
          path: { shop_id: shopId },
        }),
      });
      void invalidateSchedule();
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  });

  const createTimeOff = useMutation({
    mutationFn: () =>
      createTimeOffApiV1ShopsShopIdBarbersBarberIdTimeOffPost({
        path: { shop_id: shopId, barber_id: selectedId! },
        body: {
          start_at: `${offDate}T00:00:00Z`,
          end_at: `${offDate}T23:59:59Z`,
          reason: offReason.trim() || "Time off",
        },
      }),
    onSuccess: () => {
      setOffDate("");
      setOffReason("");
      toast.success("Time off added — those slots are now unavailable");
      void invalidateSchedule();
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  });

  const deleteTimeOff = useMutation({
    mutationFn: (id: string) =>
      deleteTimeOffApiV1ShopsShopIdBarbersBarberIdTimeOffTimeOffIdDelete({
        path: { shop_id: shopId, barber_id: selectedId!, time_off_id: id },
      }),
    onSuccess: () => {
      toast.success("Time off removed");
      void invalidateSchedule();
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  });

  if (q.isPending) return <ListSkeleton rows={4} />;
  if (q.isError)
    return (
      <ErrorState
        message={getErrorMessage(q.error)}
        onRetry={() => void q.refetch()}
      />
    );

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
          <SelectTrigger aria-label="Choose a barber">
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
            <h2 className="text-base font-semibold">
              Weekly hours for {barber.name}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Add a second period on a day to leave a lunch break out of the
              booking grid.
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
              className="mt-4 w-full sm:w-auto"
              disabled={!!problem || saveHours.isPending}
              onClick={() => saveHours.mutate(draft)}
            >
              {saveHours.isPending ? "Saving…" : "Save working hours"}
            </Button>
          </section>

          <section>
            <h2 className="text-base font-semibold">Time off</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Days off, leave or anything else that should stop bookings.
            </p>

            <div className="mt-3 rounded-md border border-hairline bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="off-date">Date</Label>
                  <Input
                    id="off-date"
                    type="date"
                    min={todayISO()}
                    value={offDate}
                    onChange={(e) => setOffDate(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="off-reason">Reason</Label>
                  <Input
                    id="off-reason"
                    value={offReason}
                    onChange={(e) => setOffReason(e.target.value)}
                    placeholder="e.g. Family wedding"
                    className="mt-2"
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

            {timeOff.length === 0 ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarOff className="size-4" aria-hidden /> No time off
                booked.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {[...timeOff]
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((t) => (
                    <li
                      key={t.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-sm border border-hairline bg-card p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {longDate(t.date)}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {t.reason}
                        </p>
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
