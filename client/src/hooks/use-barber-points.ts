import { useQuery, useQueries } from "@tanstack/react-query";
import { getBarberPointsApiV1ShopsShopIdBarbersBarberIdPointsGet } from "@/lib/api/generated/clients/getBarberPointsApiV1ShopsShopIdBarbersBarberIdPointsGet";
import { getShopPointsSummaryApiV1ShopsShopIdPointsGet } from "@/lib/api/generated/clients/getShopPointsSummaryApiV1ShopsShopIdPointsGet";
import { listShopBarbersApiV1ShopsShopIdBarbersGetQueryOptions } from "@/lib/api/generated/hooks/useListShopBarbersApiV1ShopsShopIdBarbersGet";
import { mapBarber } from "@/lib/domain-mappers";
import type { PointEntry } from "@/lib/types";

/** Every barber at a shop with their total points and recent point history,
 * sorted highest-first. Per-barber point history is only visible to that
 * barber or shop staff with `points:view_all` — a 403 for anyone else is
 * expected and just means that barber's history shows empty, not an error
 * for the whole list. */
export function useBarberPoints(shopId: string) {
  const barbersQuery = useQuery(
    listShopBarbersApiV1ShopsShopIdBarbersGetQueryOptions({
      path: { shop_id: shopId },
    }),
  );
  const summaryQuery = useQuery({
    queryKey: ["shop-points-summary", shopId],
    queryFn: () =>
      getShopPointsSummaryApiV1ShopsShopIdPointsGet({
        path: { shop_id: shopId },
      }).then(
        (r) => r.data.data,
        () => [],
      ),
    enabled: barbersQuery.isSuccess,
  });

  const barbers = barbersQuery.data?.data ?? [];
  const pointsQueries = useQueries({
    queries: barbers.map((b) => ({
      queryKey: ["barber-points-detail", shopId, b.id],
      queryFn: () =>
        getBarberPointsApiV1ShopsShopIdBarbersBarberIdPointsGet({
          path: { shop_id: shopId, barber_id: b.id },
        }).then(
          (r) => r.data.data,
          () => null,
        ),
      enabled: barbersQuery.isSuccess,
    })),
  });

  const isPending = barbersQuery.isPending || summaryQuery.isPending;
  const isError = barbersQuery.isError;

  const rows = barbers.map((b, i) => {
    const points = pointsQueries[i]?.data;
    const total =
      summaryQuery.data?.find((s) => s.barber_id === b.id)?.total_points ??
      points?.total_points ??
      0;
    const barber = mapBarber(b);
    barber.points = total;
    return {
      barber,
      history: (points?.history ?? []).map(
        (h) =>
          ({
            id: h.id,
            barberId: b.id,
            points: h.points,
            reason: h.reason,
            date: h.created_at.slice(0, 10),
          }) satisfies PointEntry,
      ),
    };
  });

  return {
    isPending,
    isError,
    isSuccess: barbersQuery.isSuccess,
    error: barbersQuery.error,
    refetch: barbersQuery.refetch,
    data: isPending
      ? undefined
      : rows.sort((a, b) => b.barber.points - a.barber.points),
  };
}
