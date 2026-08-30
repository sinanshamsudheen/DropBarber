/**
 * Fans a raw `AppointmentOut` (foreign-key ids only) out into the joined
 * shop/barber/service/customer/review data appointment screens need — a
 * single backend row can't carry this, so every appointment-list screen
 * shares this instead of re-deriving the same N sub-fetches per row. Used
 * inside `useQueries` by the composite hooks in this directory, not called
 * as a hook itself.
 */
import { getBarberApiV1BarbersBarberIdGet } from "@/lib/api/generated/clients/getBarberApiV1BarbersBarberIdGet";
import { getShopApiV1ShopsShopIdGet } from "@/lib/api/generated/clients/getShopApiV1ShopsShopIdGet";
import { getShopCustomerApiV1ShopsShopIdCustomersCustomerIdGet } from "@/lib/api/generated/clients/getShopCustomerApiV1ShopsShopIdCustomersCustomerIdGet";
import { listShopReviewsApiV1ShopsShopIdReviewsGet } from "@/lib/api/generated/clients/listShopReviewsApiV1ShopsShopIdReviewsGet";
import { listShopServicesApiV1ShopsShopIdServicesGet } from "@/lib/api/generated/clients/listShopServicesApiV1ShopsShopIdServicesGet";
import type { AppointmentOut } from "@/lib/api/generated/types/AppointmentOut";
import { barberDetailOutSchema } from "@/lib/api/generated/zod/barberDetailOutSchema";
import { shopPublicOutSchema } from "@/lib/api/generated/zod/shopPublicOutSchema";
import { validated } from "@/lib/api-client";
import {
  mapAppointmentBase,
  mapBarber,
  mapReviewOut,
  mapService,
  mapShopCustomerSummary,
} from "@/lib/domain-mappers";
import type {
  Appointment,
  Barber,
  Customer,
  Review,
  Service,
  Shop,
} from "@/lib/types";
import { mapShop } from "@/lib/domain-mappers";

/** Reconstructs a minimal AppointmentOut-shaped object from the lighter-weight
 * rows some list endpoints (shop-customer detail, my history) return, so the
 * same `hydrateAppointment` can enrich them consistently. */
export function toAppointmentOut(base: {
  id: string;
  shop_id: string;
  barber_id: string;
  service_id: string;
  customer_user_id: string;
  start_at: string;
  status: string;
  final_price: string | null;
}): AppointmentOut {
  return {
    id: base.id,
    shop_id: base.shop_id,
    barber_id: base.barber_id,
    service_id: base.service_id,
    customer_user_id: base.customer_user_id,
    start_at: base.start_at,
    end_at: base.start_at,
    status: base.status,
    booking_note: null,
    cancelled_at: null,
    completed_at: null,
    created_at: base.start_at,
    details:
      base.final_price != null
        ? {
            actual_service_id: null,
            final_price: base.final_price,
            notes: null,
            completed_by_member_id: "",
          }
        : null,
  };
}

export interface HydratedAppointment extends Appointment {
  shop: Shop;
  barber: Barber;
  service: Service | undefined;
  customer: Customer | undefined;
  review: Review | null;
}

/** Fetches the peripheral entities a raw appointment references: shop,
 * barber and service are all public data reachable from a valid
 * appointment's foreign keys, so those lookups are not swallowed on
 * failure. The customer detail lookup is shop-staff-permission-gated
 * (`customers.read`) and best-effort: a customer viewing their own booking
 * has no such permission and gets `undefined` for `customer`, which is
 * expected, not an error. */
export async function hydrateAppointment(
  a: AppointmentOut,
): Promise<HydratedAppointment> {
  const durationMin = Math.round(
    (new Date(a.end_at).getTime() - new Date(a.start_at).getTime()) / 60000,
  );
  const [servicesRes, shopRes, barberRes, customerRes, reviewsRes] =
    await Promise.all([
      listShopServicesApiV1ShopsShopIdServicesGet({
        path: { shop_id: a.shop_id },
      }),
      getShopApiV1ShopsShopIdGet({ path: { shop_id: a.shop_id } }),
      getBarberApiV1BarbersBarberIdGet({ path: { barber_id: a.barber_id } }),
      getShopCustomerApiV1ShopsShopIdCustomersCustomerIdGet({
        path: { shop_id: a.shop_id, customer_id: a.customer_user_id },
      }).catch(() => null),
      listShopReviewsApiV1ShopsShopIdReviewsGet({
        path: { shop_id: a.shop_id },
        query: { page_size: 100 },
      }).catch(() => null),
    ]);

  const serviceRow = servicesRes.data.data.find((s) => s.id === a.service_id);
  const price = serviceRow ? Number(serviceRow.price) : 0;
  const base = mapAppointmentBase(a, durationMin, price);
  const reviewRow = reviewsRes?.data.data.find(
    (r) => r.appointment_id === a.id,
  );

  return {
    ...base,
    shop: mapShop(validated(shopPublicOutSchema, shopRes.data.data)),
    barber: mapBarber(
      validated(barberDetailOutSchema, barberRes.data.data).barber,
    ),
    service: serviceRow ? mapService(serviceRow, a.shop_id) : undefined,
    customer: customerRes
      ? mapShopCustomerSummary(customerRes.data.data)
      : undefined,
    review: reviewRow ? mapReviewOut(reviewRow, a.shop_id) : null,
  };
}
