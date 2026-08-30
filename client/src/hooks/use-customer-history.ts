import { useQuery, useQueries } from "@tanstack/react-query";
import { getMyHistoryApiV1MeHistoryGet } from "@/lib/api/generated/clients/getMyHistoryApiV1MeHistoryGet";
import {
  hydrateAppointment,
  toAppointmentOut,
  type HydratedAppointment,
} from "./appointment-hydration";

/** The customer's own cross-shop history (`GET /me/history` — status != booked,
 * identity from the JWT only), hydrated with joined shop/barber/service data.
 * Used by `/history`. */
export function useCustomerHistory(options: { enabled?: boolean } = {}) {
  const listQuery = useQuery({
    queryKey: ["customer-history"],
    queryFn: async () => (await getMyHistoryApiV1MeHistoryGet({})).data.data,
    enabled: options.enabled ?? true,
  });

  const rows = listQuery.data ?? [];
  const hydrated = useQueries({
    queries: rows.map((item) => ({
      queryKey: ["appointment-hydrated", item.appointment_id],
      queryFn: () =>
        hydrateAppointment(
          toAppointmentOut({
            id: item.appointment_id,
            shop_id: item.shop_id,
            barber_id: item.barber_id,
            service_id: item.service_id,
            customer_user_id: "",
            start_at: item.start_at,
            status: item.status,
            final_price: item.final_price,
          }),
        ),
      enabled: listQuery.isSuccess,
    })),
  });

  const isPending = listQuery.isPending || hydrated.some((h) => h.isPending);
  const isError = listQuery.isError || hydrated.some((h) => h.isError);
  const error = listQuery.error ?? hydrated.find((h) => h.error)?.error;
  const data = hydrated
    .map((h) => h.data)
    .filter((a): a is HydratedAppointment => a !== undefined);

  return {
    isPending,
    isError,
    error,
    data: isPending ? undefined : data,
    refetch: listQuery.refetch,
  };
}
