import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { BarberAvatar } from "@/components/cards/barber-card";
import { ReviewCard } from "@/components/cards/review-card";
import { Rating } from "@/components/common/rating";
import { ErrorState, ListSkeleton } from "@/components/common/states";
import { CustomerShell } from "@/components/layout/customer-shell";
import { Button } from "@/components/ui/button";
import { getAvailabilityApiV1ShopsShopIdBarbersBarberIdAvailabilityGetQueryOptions } from "@/lib/api/generated/hooks/useGetAvailabilityApiV1ShopsShopIdBarbersBarberIdAvailabilityGet";
import { getBarberApiV1BarbersBarberIdGetQueryOptions } from "@/lib/api/generated/hooks/useGetBarberApiV1BarbersBarberIdGet";
import { listBarberReviewsApiV1BarbersBarberIdReviewsGetQueryOptions } from "@/lib/api/generated/hooks/useListBarberReviewsApiV1BarbersBarberIdReviewsGet";
import { listShopServicesApiV1ShopsShopIdServicesGetQueryOptions } from "@/lib/api/generated/hooks/useListShopServicesApiV1ShopsShopIdServicesGet";
import { getErrorMessage } from "@/lib/api-client";
import {
  mapBarber,
  mapReviewOut,
  mapService,
  mapShop,
} from "@/lib/domain-mappers";
import { addDaysISO, duration, money, timeLabel, todayISO } from "@/lib/format";

export const Route = createFileRoute("/shops/$shopId/barbers/$barberId")({
  head: () => ({
    meta: [
      { title: "Barber profile — Drop" },
      {
        name: "description",
        content:
          "See a barber's services, timings, rating and next available slots.",
      },
      { property: "og:title", content: "Barber profile — Drop" },
      {
        property: "og:description",
        content: "Services, timings and availability for this barber.",
      },
    ],
  }),
  component: BarberProfile,
});

function BarberProfile() {
  const { shopId, barberId } = Route.useParams();
  const navigate = useNavigate();
  const barberRes = useQuery(
    getBarberApiV1BarbersBarberIdGetQueryOptions({
      path: { barber_id: barberId },
    }),
  );
  const servicesRes = useQuery(
    listShopServicesApiV1ShopsShopIdServicesGetQueryOptions({
      path: { shop_id: shopId },
    }),
  );
  const reviewsRes = useQuery(
    listBarberReviewsApiV1BarbersBarberIdReviewsGetQueryOptions({
      path: { barber_id: barberId },
      query: { page_size: 100 },
    }),
  );
  const isPending =
    barberRes.isPending || servicesRes.isPending || reviewsRes.isPending;
  const isError =
    barberRes.isError || servicesRes.isError || reviewsRes.isError;
  const error = barberRes.error ?? servicesRes.error ?? reviewsRes.error;
  const q = {
    isPending,
    isError,
    error,
    refetch: barberRes.refetch,
    data:
      isPending || !barberRes.data || !servicesRes.data || !reviewsRes.data
        ? undefined
        : {
            barber: mapBarber(barberRes.data.data.barber),
            shop: mapShop(barberRes.data.data.shop),
            services: servicesRes.data.data.map((s) => mapService(s, shopId)),
            reviews: reviewsRes.data.data.map((r) =>
              mapReviewOut(r, shopId, barberId),
            ),
          },
  };

  const firstService = q.data?.barber.services.find((s) => s.active);
  const slotsQuery = useQuery({
    ...getAvailabilityApiV1ShopsShopIdBarbersBarberIdAvailabilityGetQueryOptions(
      {
        path: { shop_id: shopId, barber_id: barberId },
        query: { service_id: firstService?.serviceId ?? "", date: todayISO() },
      },
    ),
    enabled: !!firstService,
  });
  const tomorrowQuery = useQuery({
    ...getAvailabilityApiV1ShopsShopIdBarbersBarberIdAvailabilityGetQueryOptions(
      {
        path: { shop_id: shopId, barber_id: barberId },
        query: {
          service_id: firstService?.serviceId ?? "",
          date: addDaysISO(1),
        },
      },
    ),
    enabled: !!firstService,
  });

  if (q.isPending) {
    return (
      <CustomerShell>
        <div className="page-narrow pt-8 sm:pt-10">
          <ListSkeleton rows={4} />
        </div>
      </CustomerShell>
    );
  }
  if (q.isError || !q.data) {
    return (
      <CustomerShell>
        <div className="page-narrow pt-8 sm:pt-10">
          <ErrorState
            message={getErrorMessage(q.error)}
            onRetry={() => void q.refetch()}
          />
        </div>
      </CustomerShell>
    );
  }

  const { barber, shop, services, reviews } = q.data;
  const offered = barber.services.filter((s) => s.active);

  return (
    <CustomerShell className="pb-32 md:pb-16">
      <div className="page-narrow pt-6">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-4 rounded-full"
          onClick={() =>
            void navigate({ to: "/shops/$shopId", params: { shopId } })
          }
        >
          <ArrowLeft className="size-4" aria-hidden /> {shop.name}
        </Button>

        <div className="mt-6 flex items-center gap-5">
          <BarberAvatar barber={barber} className="size-20" />
          <div className="min-w-0">
            <h1 className="type-display-lg truncate text-ink">{barber.name}</h1>
            <Rating
              value={barber.rating}
              count={barber.reviewCount}
              size="md"
              className="mt-1"
            />
            <p className="mt-1 text-sm text-muted-foreground">{shop.name}</p>
          </div>
        </div>

        <p className="mt-6 text-base leading-relaxed text-body">{barber.bio}</p>

        <h2 className="type-display-md mt-6 border-t border-hairline pt-6 text-ink sm:mt-10 sm:pt-8">
          Services &amp; timings
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Timings are specific to {barber.name.split(" ")[0]}.
        </p>
        <ul className="mt-5 space-y-3">
          {offered.map((bs) => {
            const service = services.find((s) => s.id === bs.serviceId);
            if (!service) return null;
            return (
              <li
                key={bs.serviceId}
                className="flex items-center gap-4 rounded-md border border-hairline bg-card p-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="type-title-md truncate text-ink">
                    {service.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {duration(bs.durationMin)}
                  </p>
                </div>
                <span className="text-base font-semibold text-ink">
                  {money(bs.priceOverride ?? service.price)}
                </span>
              </li>
            );
          })}
        </ul>

        <h2 className="type-display-md mt-6 border-t border-hairline pt-6 text-ink sm:mt-10 sm:pt-8">
          Next available
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {[
            {
              label: "Today",
              slots: slotsQuery.data?.data.slots ?? [],
              loading: slotsQuery.isPending,
            },
            {
              label: "Tomorrow",
              slots: tomorrowQuery.data?.data.slots ?? [],
              loading: tomorrowQuery.isPending,
            },
          ].map((group) => (
            <div
              key={group.label}
              className="rounded-md border border-hairline bg-card p-5"
            >
              <p className="type-title-md text-ink">{group.label}</p>
              {group.loading ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Checking availability…
                </p>
              ) : group.slots.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {group.slots.slice(0, 8).map((s) => (
                    <span
                      key={s.time}
                      className="rounded-full border border-hairline px-3 py-1 text-sm font-medium text-ink"
                    >
                      {timeLabel(s.time.slice(0, 5))}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  No available times.
                </p>
              )}
            </div>
          ))}
        </div>

        {reviews.length > 0 && (
          <>
            <h2 className="type-display-md mt-6 border-t border-hairline pt-6 text-ink sm:mt-10 sm:pt-8">
              Reviews
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {reviews.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-hairline bg-background px-6 py-3 md:bottom-0">
        <div className="mx-auto max-w-2xl">
          <Button asChild className="w-full">
            <Link
              to="/shops/$shopId/book"
              params={{ shopId }}
              search={{ step: 1, barberId }}
            >
              Book with {barber.name.split(" ")[0]}
            </Link>
          </Button>
        </div>
      </div>
    </CustomerShell>
  );
}
