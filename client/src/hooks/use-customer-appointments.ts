import { useQuery, useQueries } from "@tanstack/react-query";
import { listAppointmentsApiV1AppointmentsGet } from "@/lib/api/generated/clients/listAppointmentsApiV1AppointmentsGet";
import {
  hydrateAppointment,
  type HydratedAppointment,
} from "./appointment-hydration";

/** The logged-in customer's own bookings (upcoming/past), hydrated with
 * joined shop/barber/service data. Used by `/bookings`. */
export function useCustomerAppointments(options: { enabled?: boolean } = {}) {
  const listQuery = useQuery({
    queryKey: ["appointments", "mine"],
    queryFn: async () =>
      (await listAppointmentsApiV1AppointmentsGet({})).data.data,
    enabled: options.enabled ?? true,
  });

  const rows = listQuery.data ?? [];
  const hydrated = useQueries({
    queries: rows.map((a) => ({
      queryKey: ["appointment-hydrated", a.id],
      queryFn: () => hydrateAppointment(a),
      enabled: listQuery.isSuccess,
    })),
  });

  const isPending = listQuery.isPending || hydrated.some((h) => h.isPending);
  const isError = listQuery.isError || hydrated.some((h) => h.isError);
  const error = listQuery.error ?? hydrated.find((h) => h.error)?.error;
  const all = hydrated
    .map((h) => h.data)
    .filter((a): a is HydratedAppointment => a !== undefined);

  const now = Date.now();
  const startsAt = (a: HydratedAppointment) =>
    new Date(`${a.date}T${a.time}:00`).getTime();

  return {
    isPending,
    isError,
    error,
    data: isPending
      ? undefined
      : {
          upcoming: all
            .filter(
              (a) => a.status === "booked" && startsAt(a) >= now - 3600_000,
            )
            .sort((a, b) => startsAt(a) - startsAt(b)),
          past: all
            .filter(
              (a) => !(a.status === "booked" && startsAt(a) >= now - 3600_000),
            )
            .sort((a, b) => startsAt(b) - startsAt(a)),
        },
    refetch: listQuery.refetch,
  };
}
