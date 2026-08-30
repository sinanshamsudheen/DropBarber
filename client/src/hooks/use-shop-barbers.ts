import { useQuery } from "@tanstack/react-query";
import { listShopBarbersApiV1ShopsShopIdBarbersGetQueryOptions } from "@/lib/api/generated/hooks/useListShopBarbersApiV1ShopsShopIdBarbersGet";
import { mapBarber } from "@/lib/domain-mappers";
import { useShopAppointments } from "./use-shop-appointments";

/** A shop's barbers (public profile shape, active or not) with today's
 * non-cancelled booking count each — the barbers list and schedule picker
 * both need this. */
export function useShopBarbers(shopId: string) {
  const barbersQuery = useQuery(
    listShopBarbersApiV1ShopsShopIdBarbersGetQueryOptions({
      path: { shop_id: shopId },
    }),
  );
  const today = new Date().toISOString().slice(0, 10);
  const appointmentsQuery = useShopAppointments(shopId, today);

  const isPending = barbersQuery.isPending;
  const isError = barbersQuery.isError;

  return {
    isPending,
    isError,
    isSuccess: barbersQuery.isSuccess,
    error: barbersQuery.error,
    refetch: barbersQuery.refetch,
    data: isPending
      ? undefined
      : barbersQuery.data?.data.map((b) => ({
          barber: mapBarber(b),
          todayCount: (appointmentsQuery.data ?? []).filter(
            (a) => a.barberId === b.id && a.status !== "cancelled",
          ).length,
        })),
  };
}
