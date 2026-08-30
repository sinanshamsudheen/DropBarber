/**
 * Per-shop "from ₹X" price + next-available-slot enrichment for the
 * discovery grid — inherently a fan-out of several sub-requests per shop, so
 * (like appointment hydration) it's a shared async function composed via
 * `useQueries` rather than duplicated per call site.
 */
import { useQuery, useQueries } from "@tanstack/react-query";
import { getAvailabilityApiV1ShopsShopIdBarbersBarberIdAvailabilityGet } from "@/lib/api/generated/clients/getAvailabilityApiV1ShopsShopIdBarbersBarberIdAvailabilityGet";
import { listShopBarbersApiV1ShopsShopIdBarbersGet } from "@/lib/api/generated/clients/listShopBarbersApiV1ShopsShopIdBarbersGet";
import { listShopServicesApiV1ShopsShopIdServicesGet } from "@/lib/api/generated/clients/listShopServicesApiV1ShopsShopIdServicesGet";

export interface DiscoveryEnrichment {
  fromPrice: number | null;
  next: { date: string; time: string } | null;
}

export async function fetchDiscoveryEnrichment(
  shopId: string,
): Promise<DiscoveryEnrichment> {
  const [servicesRes, barbersRes] = await Promise.all([
    listShopServicesApiV1ShopsShopIdServicesGet({ path: { shop_id: shopId } }),
    listShopBarbersApiV1ShopsShopIdBarbersGet({ path: { shop_id: shopId } }),
  ]);
  const prices = servicesRes.data.data.map((s) => Number(s.price));
  const fromPrice = prices.length ? Math.min(...prices) : null;

  const barber = barbersRes.data.data.find((b) => b.services.length > 0);
  const service = barber?.services[0];
  let next: { date: string; time: string } | null = null;
  if (barber && service) {
    for (let offset = 0; offset < 7; offset++) {
      const date = new Date();
      date.setDate(date.getDate() + offset);
      const dateStr = date.toISOString().slice(0, 10);
      const availability =
        await getAvailabilityApiV1ShopsShopIdBarbersBarberIdAvailabilityGet({
          path: { shop_id: shopId, barber_id: barber.id },
          query: { service_id: service.service_id, date: dateStr },
        });
      const first = availability.data.data.slots[0];
      if (first) {
        next = { date: dateStr, time: first.time.slice(0, 5) };
        break;
      }
    }
  }

  return { fromPrice, next };
}

/** Single-shop enrichment, for a shop's own profile page. */
export function useShopDiscoveryEnrichment(shopId: string) {
  return useQuery({
    queryKey: ["discovery-enrichment", shopId],
    queryFn: () => fetchDiscoveryEnrichment(shopId),
  });
}

/** Batch enrichment for the discovery grid — one entry per shop id, in order. */
export function useDiscoveryEnrichments(shopIds: string[]) {
  return useQueries({
    queries: shopIds.map((shopId) => ({
      queryKey: ["discovery-enrichment", shopId],
      queryFn: () => fetchDiscoveryEnrichment(shopId),
    })),
  });
}
