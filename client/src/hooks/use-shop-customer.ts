import { useQuery, useQueries } from "@tanstack/react-query";
import { getShopCustomerApiV1ShopsShopIdCustomersCustomerIdGetQueryOptions } from "@/lib/api/generated/hooks/useGetShopCustomerApiV1ShopsShopIdCustomersCustomerIdGet";
import { mapShopCustomerSummary } from "@/lib/domain-mappers";
import type { Barber, ShopNote } from "@/lib/types";
import {
  hydrateAppointment,
  toAppointmentOut,
  type HydratedAppointment,
} from "./appointment-hydration";

/** A shop-staff view of one customer: profile summary, visit stats, notes,
 * reference media, and their appointment history at this shop (hydrated
 * with joined barber/service data). Used by the shop customer detail screen
 * and the appointment detail screen's "previous visits" section. */
export function useShopCustomer(
  shopId: string,
  customerId: string | undefined,
) {
  const detailQuery = useQuery({
    ...getShopCustomerApiV1ShopsShopIdCustomersCustomerIdGetQueryOptions({
      path: { shop_id: shopId, customer_id: customerId ?? "" },
    }),
    enabled: !!customerId,
  });

  const rows = detailQuery.data?.data.appointments ?? [];
  const hydrated = useQueries({
    queries: rows.map((item) => ({
      queryKey: ["appointment-hydrated", item.id],
      queryFn: () =>
        hydrateAppointment(
          toAppointmentOut({
            id: item.id,
            shop_id: shopId,
            barber_id: item.barber_id,
            service_id: item.service_id,
            customer_user_id: customerId ?? "",
            start_at: item.start_at,
            status: item.status,
            final_price: item.final_price,
          }),
        ),
      enabled: detailQuery.isSuccess,
    })),
  });

  const isPending =
    detailQuery.isPending ||
    (rows.length > 0 && hydrated.some((h) => h.isPending));
  const isError = detailQuery.isError || hydrated.some((h) => h.isError);
  const error = detailQuery.error ?? hydrated.find((h) => h.error)?.error;
  const appointments = hydrated
    .map((h) => h.data)
    .filter((a): a is HydratedAppointment => a !== undefined);

  const row = detailQuery.data?.data;
  const completed =
    row?.appointments.filter((a) => a.status === "completed") ?? [];

  return {
    isPending,
    isError,
    error,
    refetch: detailQuery.refetch,
    data:
      isPending || !row
        ? undefined
        : {
            customer: mapShopCustomerSummary(row),
            appointments,
            visits: row.visits,
            lastVisit: row.last_visit?.slice(0, 10) ?? null,
            spend: completed.reduce(
              (sum, a) =>
                sum + (a.final_price != null ? Number(a.final_price) : 0),
              0,
            ),
            preferredBarber: null as Barber | null,
            notes: row.notes
              ? ([
                  {
                    id: "note",
                    shopId,
                    customerId: row.customer_user_id,
                    text: row.notes,
                    date: "",
                    author: "",
                  },
                ] satisfies ShopNote[])
              : ([] as ShopNote[]),
            referencePhotos: [] as {
              id: string;
              url: string;
              caption?: string | undefined;
            }[],
          },
  };
}
