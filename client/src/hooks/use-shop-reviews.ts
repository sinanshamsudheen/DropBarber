import { useQuery } from "@tanstack/react-query";
import { listShopReviewsApiV1ShopsShopIdReviewsGetQueryOptions } from "@/lib/api/generated/hooks/useListShopReviewsApiV1ShopsShopIdReviewsGet";
import { mapReviewOut } from "@/lib/domain-mappers";

/** All of a shop's reviews plus a star-rating distribution and average —
 * the shop-management reviews dashboard. */
export function useShopReviews(shopId: string) {
  return useQuery({
    ...listShopReviewsApiV1ShopsShopIdReviewsGetQueryOptions({
      path: { shop_id: shopId },
      query: { page_size: 100 },
    }),
    select: (res) => {
      const list = res.data.map((r) => mapReviewOut(r, shopId));
      const distribution = [5, 4, 3, 2, 1].map((star) => ({
        star,
        count: list.filter((r) => Math.round(r.shopRating) === star).length,
      }));
      const average = list.length
        ? list.reduce((s, r) => s + r.shopRating, 0) / list.length
        : 0;
      return { reviews: list, distribution, average, total: list.length };
    },
  });
}
