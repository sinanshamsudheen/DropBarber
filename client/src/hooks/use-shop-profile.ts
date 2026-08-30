import { useQuery } from "@tanstack/react-query";
import { getShopApiV1ShopsShopIdGetQueryOptions } from "@/lib/api/generated/hooks/useGetShopApiV1ShopsShopIdGet";
import { listShopBarbersApiV1ShopsShopIdBarbersGetQueryOptions } from "@/lib/api/generated/hooks/useListShopBarbersApiV1ShopsShopIdBarbersGet";
import { listShopReviewsApiV1ShopsShopIdReviewsGetQueryOptions } from "@/lib/api/generated/hooks/useListShopReviewsApiV1ShopsShopIdReviewsGet";
import { listShopServicesApiV1ShopsShopIdServicesGetQueryOptions } from "@/lib/api/generated/hooks/useListShopServicesApiV1ShopsShopIdServicesGet";
import { shopPublicOutSchema } from "@/lib/api/generated/zod/shopPublicOutSchema";
import { validated } from "@/lib/api-client";
import {
  mapBarber,
  mapReviewOut,
  mapService,
  mapShop,
} from "@/lib/domain-mappers";

/** A shop's full public profile — shop + active services + active barbers +
 * reviews — the shop profile, booking flow, and shop-settings screens all
 * need this same 4-request composite. */
export function useShopProfile(shopId: string) {
  const shopQuery = useQuery(
    getShopApiV1ShopsShopIdGetQueryOptions({ path: { shop_id: shopId } }),
  );
  const servicesQuery = useQuery(
    listShopServicesApiV1ShopsShopIdServicesGetQueryOptions({
      path: { shop_id: shopId },
    }),
  );
  const barbersQuery = useQuery(
    listShopBarbersApiV1ShopsShopIdBarbersGetQueryOptions({
      path: { shop_id: shopId },
    }),
  );
  const reviewsQuery = useQuery(
    listShopReviewsApiV1ShopsShopIdReviewsGetQueryOptions({
      path: { shop_id: shopId },
      query: { page_size: 100 },
    }),
  );

  const isPending =
    shopQuery.isPending ||
    servicesQuery.isPending ||
    barbersQuery.isPending ||
    reviewsQuery.isPending;
  const isError =
    shopQuery.isError ||
    servicesQuery.isError ||
    barbersQuery.isError ||
    reviewsQuery.isError;
  const error =
    shopQuery.error ??
    servicesQuery.error ??
    barbersQuery.error ??
    reviewsQuery.error;

  return {
    isPending,
    isError,
    error,
    refetch: shopQuery.refetch,
    data:
      isPending ||
      !shopQuery.data ||
      !servicesQuery.data ||
      !barbersQuery.data ||
      !reviewsQuery.data
        ? undefined
        : {
            shop: mapShop(validated(shopPublicOutSchema, shopQuery.data.data)),
            services: servicesQuery.data.data.map((s) => mapService(s, shopId)),
            barbers: barbersQuery.data.data.map(mapBarber),
            reviews: reviewsQuery.data.data.map((r) => mapReviewOut(r, shopId)),
          },
  };
}
