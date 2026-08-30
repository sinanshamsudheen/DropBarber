import { useQuery } from "@tanstack/react-query";
import { getBarberApiV1BarbersBarberIdGetQueryOptions } from "@/lib/api/generated/hooks/useGetBarberApiV1BarbersBarberIdGet";
import { getManagedBarberApiV1ShopsShopIdBarbersBarberIdGetQueryOptions } from "@/lib/api/generated/hooks/useGetManagedBarberApiV1ShopsShopIdBarbersBarberIdGet";
import { listServicesManageApiV1ShopsShopIdServicesManageGetQueryOptions } from "@/lib/api/generated/hooks/useListServicesManageApiV1ShopsShopIdServicesManageGet";
import { mapManagedBarber, mapService } from "@/lib/domain-mappers";

/** A shop-staff view of one barber: management fields (display name, bio,
 * status) plus their configured per-service duration/price/active, plus the
 * shop's service catalog. Used by the barber detail and edit screens. */
export function useManagedBarber(shopId: string, barberId: string) {
  const managedQuery = useQuery(
    getManagedBarberApiV1ShopsShopIdBarbersBarberIdGetQueryOptions({
      path: { shop_id: shopId, barber_id: barberId },
    }),
  );
  const servicesQuery = useQuery(
    listServicesManageApiV1ShopsShopIdServicesManageGetQueryOptions({
      path: { shop_id: shopId },
    }),
  );
  const publicBarberQuery = useQuery({
    ...getBarberApiV1BarbersBarberIdGetQueryOptions({
      path: { barber_id: barberId },
    }),
    retry: false,
  });

  const isPending =
    managedQuery.isPending ||
    servicesQuery.isPending ||
    publicBarberQuery.isPending;
  const isError = managedQuery.isError || servicesQuery.isError;

  return {
    isPending,
    isError,
    error: managedQuery.error ?? servicesQuery.error,
    refetch: managedQuery.refetch,
    data:
      isPending || !managedQuery.data || !servicesQuery.data
        ? undefined
        : {
            barber: mapManagedBarber(
              managedQuery.data.data,
              publicBarberQuery.data?.data.barber.services ?? [],
            ),
            services: servicesQuery.data.data.map((s) => mapService(s, shopId)),
          },
  };
}
