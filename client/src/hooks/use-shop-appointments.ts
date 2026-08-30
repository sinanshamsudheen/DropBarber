import { useQuery, useQueries } from "@tanstack/react-query";
import { listAppointmentsApiV1AppointmentsGet } from "@/lib/api/generated/clients/listAppointmentsApiV1AppointmentsGet";
import {
  hydrateAppointment,
  type HydratedAppointment,
} from "./appointment-hydration";

/** A shop's appointments on one date, hydrated with joined shop/barber/
 * service/customer data and sorted by time. Used by the shop-management day
 * view and appointments list. */
export function useShopAppointments(shopId: string, date: string) {
  const listQuery = useQuery({
    queryKey: ["shop-appointments", shopId, date],
    queryFn: async () =>
      (
        await listAppointmentsApiV1AppointmentsGet({
          query: { shop_id: shopId, date },
        })
      ).data.data,
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
  const data = hydrated
    .map((h) => h.data)
    .filter((a): a is HydratedAppointment => a !== undefined)
    .sort((a, b) => a.time.localeCompare(b.time));

  return {
    isPending,
    isError,
    isSuccess: !isPending && !isError,
    error,
    data: isPending ? undefined : data,
    refetch: listQuery.refetch,
  };
}
