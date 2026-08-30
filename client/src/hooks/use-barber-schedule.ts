import { useQuery } from "@tanstack/react-query";
import { getScheduleApiV1ShopsShopIdBarbersBarberIdScheduleGetQueryOptions } from "@/lib/api/generated/hooks/useGetScheduleApiV1ShopsShopIdBarbersBarberIdScheduleGet";
import { mapSchedule } from "@/lib/domain-mappers";

/** A barber's recurring working hours + time-off rows, mapped to the UI's
 * 0=Sunday `WeekSchedule` shape. Used by the shop-management schedule
 * editor. */
export function useBarberSchedule(
  shopId: string,
  barberId: string | undefined,
) {
  return useQuery({
    ...getScheduleApiV1ShopsShopIdBarbersBarberIdScheduleGetQueryOptions({
      path: { shop_id: shopId, barber_id: barberId ?? "" },
    }),
    select: (res) => mapSchedule(res.data),
    enabled: !!barberId,
  });
}
