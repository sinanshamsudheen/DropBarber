/**
 * Pure, no-IO shape adapters between the backend's real (Kubb-typed) JSON
 * responses and this app's UI-facing domain model (`./types`). These exist
 * because of permanent representational differences between backend JSON
 * and clean UI types — day-of-week indexing (backend 0=Monday, UI 0=Sunday),
 * price as a Decimal-string, and `status` strings vs UI `active` booleans —
 * not because Kubb failed to generate something. Every route file that reads
 * one of these backend shapes runs it through the matching mapper here
 * rather than re-deriving the same conversion inline.
 */
import type { AppointmentOut } from "./api/generated/types/AppointmentOut";
import type { BarberManageOut } from "./api/generated/types/BarberManageOut";
import type { BarberPublicOut } from "./api/generated/types/BarberPublicOut";
import type { BarberServicePublicOut } from "./api/generated/types/BarberServicePublicOut";
import type { MeOut } from "./api/generated/types/MeOut";
import type { ReviewOut } from "./api/generated/types/ReviewOut";
import type { ServiceManageOut } from "./api/generated/types/ServiceManageOut";
import type { ServicePublicOut } from "./api/generated/types/ServicePublicOut";
import type { ScheduleOut } from "./api/generated/types/ScheduleOut";
import type { ShopCustomerSummaryOut } from "./api/generated/types/ShopCustomerSummaryOut";
import type { ShopPublicOut } from "./api/generated/types/ShopPublicOut";
import type {
  Appointment,
  AppointmentStatus,
  Barber,
  BarberService,
  Customer,
  Review,
  Service,
  Shop,
  WorkPeriod,
} from "./types";

export function backendDayToFrontend(day: number): number {
  // backend: 0=Monday..6=Sunday. frontend OpeningHours/schedule: 0=Sunday.
  return (day + 1) % 7;
}

export function frontendDayToBackend(day: number): number {
  return (day + 6) % 7;
}

export function mapShop(s: ShopPublicOut): Shop {
  return {
    id: s.id,
    name: s.name,
    tagline: s.tagline,
    description: s.description,
    photos: s.photos,
    rating: s.rating,
    reviewCount: s.review_count,
    distanceKm: s.distance_km ?? 0,
    area: s.area,
    address: s.address,
    phone: s.phone ?? "",
    hours: s.hours
      .map((h) => ({
        day: backendDayToFrontend(h.day),
        open: h.open,
        close: h.close,
      }))
      .sort((a, b) => a.day - b.day),
  };
}

export function mapService(
  s: ServicePublicOut | ServiceManageOut,
  shopId: string,
): Service {
  return {
    id: s.id,
    shopId: "shop_id" in s ? s.shop_id : shopId,
    name: s.name,
    description: s.description ?? "",
    price: Number(s.price),
    active: "status" in s ? s.status === "active" : true,
  };
}

export function mapBarberService(bs: BarberServicePublicOut): BarberService {
  const priceOverride =
    bs.price_override != null ? Number(bs.price_override) : undefined;
  return {
    serviceId: bs.service_id,
    durationMin: bs.duration_minutes,
    ...(priceOverride !== undefined ? { priceOverride } : {}),
    active: true,
  };
}

export function mapBarber(b: BarberPublicOut): Barber {
  return {
    id: b.id,
    shopId: b.shop_id,
    name: b.name,
    bio: b.bio ?? "",
    ...(b.profile_image_url ? { photo: b.profile_image_url } : {}),
    active: true,
    rating: b.rating,
    reviewCount: b.review_count,
    points: 0,
    services: b.services.map(mapBarberService),
    schedule: [[], [], [], [], [], [], []],
    timeOff: [],
  };
}

export function mapManagedBarber(
  b: BarberManageOut,
  services: BarberServicePublicOut[] = [],
): Barber {
  return {
    id: b.id,
    shopId: "",
    name: b.display_name,
    bio: b.bio ?? "",
    ...(b.profile_image_url ? { photo: b.profile_image_url } : {}),
    active: b.status === "active",
    rating: 0,
    reviewCount: 0,
    points: 0,
    services: services.map(mapBarberService),
    schedule: [[], [], [], [], [], [], []],
    timeOff: [],
  };
}

export function isoToDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return { date, time };
}

/** durationMin/price aren't stored on the appointment — callers pass the
 * barber-service's duration/price already in hand. */
export function mapAppointmentBase(
  a: AppointmentOut,
  durationMin: number,
  price: number,
): Appointment {
  const { date, time } = isoToDateTime(a.start_at);
  const finalPrice =
    a.details?.final_price != null ? Number(a.details.final_price) : undefined;
  return {
    id: a.id,
    shopId: a.shop_id,
    barberId: a.barber_id,
    serviceId: a.service_id,
    customerId: a.customer_user_id,
    date,
    time,
    durationMin,
    price: finalPrice ?? price,
    status: a.status as AppointmentStatus,
    ...(a.booking_note ? { note: a.booking_note } : {}),
    referencePhotos: [],
    ...(a.details
      ? {
          completion: {
            actualService: a.details.actual_service_id ?? undefined,
            finalPrice: finalPrice ?? 0,
            notes: a.details.notes ?? undefined,
            finishedPhoto: undefined,
            pointsAwarded: a.status === "completed" ? 10 : 0,
          },
        }
      : {}),
    createdAt: a.created_at.slice(0, 10),
  };
}

export function mapReview(
  r: {
    id: string;
    rating: number;
    review_text: string | null;
    barber_profile_id?: string | null;
    created_at: string;
  },
  shopId: string,
  barberId?: string,
): Review {
  const resolvedBarberId = barberId ?? r.barber_profile_id ?? undefined;
  return {
    id: r.id,
    shopId,
    ...(resolvedBarberId ? { barberId: resolvedBarberId } : {}),
    appointmentId: "",
    customerId: "",
    customerName: "Customer",
    shopRating: r.rating,
    ...(resolvedBarberId ? { barberRating: r.rating } : {}),
    text: r.review_text ?? "",
    date: r.created_at.slice(0, 10),
  };
}

export function mapReviewOut(
  r: ReviewOut,
  shopId: string,
  barberId?: string,
): Review {
  return mapReview(r, shopId, barberId);
}

export function mapShopCustomerSummary(row: ShopCustomerSummaryOut): Customer {
  return {
    id: row.customer_user_id,
    name: row.display_name ?? "Customer",
    phone: row.phone ?? "",
    email: row.email ?? "",
    preferences: "",
    savedPhotos: [],
  };
}

export function mapSchedule(data: ScheduleOut): {
  schedule: WorkPeriod[][];
  timeOff: { id: string; date: string; reason: string }[];
} {
  const schedule: WorkPeriod[][] = [[], [], [], [], [], [], []];
  for (const period of data.working_hours) {
    const day = backendDayToFrontend(period.day_of_week);
    schedule[day]?.push({
      start: period.start_time.slice(0, 5),
      end: period.end_time.slice(0, 5),
    });
  }
  return {
    schedule,
    timeOff: data.time_off.map((t) => ({
      id: t.id,
      date: t.start_at.slice(0, 10),
      reason: t.reason ?? "",
    })),
  };
}

export function mapMeToCustomerProfile(me: MeOut): Customer {
  return {
    id: me.id,
    name: me.display_name ?? "",
    phone: "",
    email: me.email ?? "",
    ...(me.avatar_url ? { photo: me.avatar_url } : {}),
    preferences: "",
    savedPhotos: [],
  };
}
