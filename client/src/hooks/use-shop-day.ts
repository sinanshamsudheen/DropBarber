import { useQuery } from "@tanstack/react-query";
import { listShopBarbersApiV1ShopsShopIdBarbersGetQueryOptions } from "@/lib/api/generated/hooks/useListShopBarbersApiV1ShopsShopIdBarbersGet";
import type { WorkPeriod } from "@/lib/types";
import { useShopAppointments } from "./use-shop-appointments";

/** Today's date + a shop's appointments today + barber summary rows (name,
 * active, today's booking count) — the shop-management "Today" dashboard. */
export function useShopDay(shopId: string) {
  const date = new Date().toISOString().slice(0, 10);
  const appointmentsQuery = useShopAppointments(shopId, date);

  const barbersQuery = useQuery(
    listShopBarbersApiV1ShopsShopIdBarbersGetQueryOptions({
      path: { shop_id: shopId },
    }),
  );

  const isPending = appointmentsQuery.isPending || barbersQuery.isPending;
  const isError = appointmentsQuery.isError || barbersQuery.isError;
  const error = appointmentsQuery.error ?? barbersQuery.error;

  const appointments = appointmentsQuery.data ?? [];
  const barbers = (barbersQuery.data?.data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    active: true,
    working: true,
    periods: [] as WorkPeriod[],
    todayCount: appointments.filter((a) => a.barberId === b.id).length,
  }));

  return {
    isPending,
    isError,
    error,
    refetch: () => {
      void appointmentsQuery.refetch();
      void barbersQuery.refetch();
    },
    data: isPending ? undefined : { date, appointments, barbers },
  };
}
