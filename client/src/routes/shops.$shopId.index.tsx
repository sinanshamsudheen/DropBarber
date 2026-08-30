import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Clock, MapPin, Phone, Scissors, Star, Users } from "lucide-react";
import { BarberAvatar } from "@/components/cards/barber-card";
import { ReviewCard } from "@/components/cards/review-card";
import { ServiceCard } from "@/components/cards/service-card";
import { Rating, RatingDisplay } from "@/components/common/rating";
import { ErrorState, ListSkeleton } from "@/components/common/states";
import { CustomerShell } from "@/components/layout/customer-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getShop, nextAvailable, startingPrice } from "@/lib/api";
import { DAY_NAMES, dayLabel, duration, money, timeLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/shops/$shopId/")({
  head: () => ({
    meta: [
      { title: "Barber shop profile — Drop" },
      {
        name: "description",
        content: "See services, barbers, prices, opening hours and reviews, then book.",
      },
      { property: "og:title", content: "Barber shop profile — Drop" },
      {
        property: "og:description",
        content: "Services, barbers, prices and reviews — book in a few taps.",
      },
    ],
  }),
  component: ShopProfile,
});

/** The rating floor the upstream system uses for its guest-favourite plate. */
const FAVOURITE_RATING = 4.8;

function ShopProfile() {
  const { shopId } = Route.useParams();
  const navigate = useNavigate();

  const shopQuery = useQuery({
    queryKey: ["shop", shopId],
    queryFn: () => getShop(shopId),
  });
  const nextQuery = useQuery({
    queryKey: ["next", shopId],
    queryFn: () => nextAvailable(shopId),
  });

  if (shopQuery.isPending) {
    return (
      <CustomerShell>
        <div className="page-narrow space-y-6 pt-8 sm:pt-10" aria-busy="true" aria-live="polite">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-64 w-full rounded-md sm:h-[420px]" />
          <ListSkeleton rows={3} />
        </div>
      </CustomerShell>
    );
  }

  if (shopQuery.isError) {
    return (
      <CustomerShell>
        <div className="page-narrow pt-8 sm:pt-10">
          <ErrorState
            message={(shopQuery.error as Error).message}
            onRetry={() => void shopQuery.refetch()}
          />
        </div>
      </CustomerShell>
    );
  }

  const { shop, services, barbers, reviews } = shopQuery.data;
  const activeServices = services.filter((s) => s.active);
  const activeBarbers = barbers.filter((b) => b.active);
  const today = new Date().getDay();
  const fromPrice = startingPrice(shopId);
  const openToday = shop.hours[today]?.open;
  const secondaryPhotos = shop.photos.slice(1, 5);

  return (
    <CustomerShell className="pb-32 md:pb-16 lg:pb-0">
      <div className="page-narrow pt-6">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-4 rounded-full"
          onClick={() => void navigate({ to: "/" })}
        >
          <ArrowLeft className="size-4" aria-hidden />
          All shops
        </Button>

        <h1 className="type-display-lg mt-4 text-ink">{shop.name}</h1>
        <p className="mt-1 text-base text-muted-foreground">{shop.tagline}</p>

        {/* Photo banner: hero plate plus a secondary grid, all corner-clipped. The
            secondary column drops to one column when a shop has few photos, so
            the plate never leaves dead space beside the hero. */}
        <div className="mt-5 grid gap-2 overflow-hidden rounded-md sm:grid-cols-2 sm:grid-rows-[420px]">
          <img
            src={shop.photos[0]}
            alt={`Inside ${shop.name}`}
            width={1024}
            height={768}
            className="h-64 w-full object-cover sm:h-full sm:min-h-0"
          />
          {secondaryPhotos.length > 0 && (
            <div
              className={cn(
                "hidden min-h-0 auto-rows-fr gap-2 sm:grid",
                secondaryPhotos.length > 2 ? "grid-cols-2" : "grid-cols-1",
              )}
            >
              {secondaryPhotos.map((p, i) => (
                <img
                  key={i}
                  src={p}
                  alt=""
                  loading="lazy"
                  className="size-full min-h-0 object-cover"
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Listing detail: body on the left, sticky reservation rail on the right. */}
      <div className="page-narrow grid gap-x-8 gap-y-6 pb-16 pt-6 sm:gap-y-8 sm:pt-8 lg:grid-cols-[minmax(0,1fr)_372px] lg:gap-x-16 lg:gap-y-10 lg:pt-10">
        <div className="min-w-0">
          <section className="border-b border-hairline pb-6 sm:pb-8">
            <h2 className="type-display-md text-ink">
              {activeBarbers.length} barbers · {activeServices.length} services
            </h2>
            <ul className="mt-4 space-y-3 text-base text-body">
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden />
                <span>
                  {shop.address} · {shop.distanceKm} km away
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Clock className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden />
                <span>
                  {openToday
                    ? `Open today ${timeLabel(openToday)} – ${timeLabel(shop.hours[today]!.close!)}`
                    : "Closed today"}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Phone className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden />
                <span>{shop.phone}</span>
              </li>
              {nextQuery.data && (
                <li className="flex items-start gap-3 font-medium text-ink">
                  <Star className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden />
                  <span>
                    Next available {dayLabel(nextQuery.data.date)} at{" "}
                    {timeLabel(nextQuery.data.time)}
                  </span>
                </li>
              )}
            </ul>
          </section>

          <section className="border-b border-hairline py-6 sm:py-8">
            <h2 className="type-display-md text-ink">About this shop</h2>
            <p className="mt-4 text-base leading-relaxed text-body">{shop.description}</p>
          </section>

          <section id="services" className="border-b border-hairline py-6 sm:py-8">
            <h2 className="type-display-md text-ink">What this shop offers</h2>
            <div className="mt-5 space-y-3">
              {activeServices.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  durationHint="Duration depends on the barber"
                  onSelect={() =>
                    void navigate({
                      to: "/shops/$shopId/book",
                      params: { shopId },
                      search: { step: 2, serviceId: service.id },
                    })
                  }
                />
              ))}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Prices shown are the shop's standard price. Each barber sets their own timing per
              service — you'll see the exact duration when you pick a barber.
            </p>
          </section>

          <section className="border-b border-hairline py-6 sm:py-8">
            <h2 className="type-display-md text-ink">Meet the barbers</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {activeBarbers.map((barber) => (
                <Link
                  key={barber.id}
                  to="/shops/$shopId/barbers/$barberId"
                  params={{ shopId, barberId: barber.id }}
                  className="flex items-center gap-4 rounded-md border border-hairline bg-card p-4 transition-shadow hover:shadow-float"
                >
                  <BarberAvatar barber={barber} />
                  <div className="min-w-0 flex-1">
                    <p className="type-title-md truncate text-ink">{barber.name}</p>
                    <p className="line-clamp-1 text-sm text-muted-foreground">{barber.bio}</p>
                    <div className="mt-1.5 flex items-center gap-3">
                      <Rating value={barber.rating} count={barber.reviewCount} />
                      <span className="text-sm text-muted-foreground">
                        {barber.services.filter((s) => s.active).length} services
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="border-b border-hairline py-6 sm:py-8">
            <h2 className="type-display-md text-ink">Opening hours</h2>
            <ul className="mt-5 divide-y divide-hairline-soft">
              {shop.hours.map((h) => (
                <li
                  key={h.day}
                  className={cn(
                    "flex items-center justify-between py-3 text-base",
                    h.day === today ? "font-medium text-ink" : "text-body",
                  )}
                >
                  <span>{DAY_NAMES[h.day]}</span>
                  <span className={h.day === today ? "" : "text-muted-foreground"}>
                    {h.open ? `${timeLabel(h.open)} – ${timeLabel(h.close!)}` : "Closed"}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="pt-8 sm:pt-10">
            {shop.rating > 0 && (
              <div className="flex flex-col items-center pb-8">
                <RatingDisplay
                  value={shop.rating}
                  {...(shop.rating >= FAVOURITE_RATING ? { caption: "Guest favourite" } : {})}
                />
                <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
                  {shop.rating >= FAVOURITE_RATING
                    ? "One of the most loved shops on Drop, based on ratings and reviews."
                    : `Based on ${shop.reviewCount} review${shop.reviewCount === 1 ? "" : "s"}.`}
                </p>
              </div>
            )}

            <h2 className="type-display-md text-ink">
              {reviews.length} review{reviews.length === 1 ? "" : "s"}
            </h2>
            {reviews.length === 0 ? (
              <p className="mt-5 rounded-md border border-dashed border-hairline p-8 text-center text-base text-muted-foreground">
                No reviews yet. Reviews appear here after a completed appointment.
              </p>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {reviews.map((r) => (
                  <ReviewCard
                    key={r.id}
                    review={r}
                    barberName={barbers.find((b) => b.id === r.barberId)?.name}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* DESIGN.md reservation-card: sticky right rail, hairline border, one shadow tier. */}
        <aside className="hidden lg:block">
          <div className="sticky top-28 rounded-md border border-hairline bg-card p-6 shadow-float">
            <p className="text-ink">
              <span className="type-display-md">{fromPrice !== null ? money(fromPrice) : "—"}</span>{" "}
              <span className="text-base text-muted-foreground">from</span>
            </p>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center gap-2 text-body">
                <Scissors className="size-4 shrink-0 text-ink" aria-hidden />
                {activeServices.length} service
                {activeServices.length === 1 ? "" : "s"} available
              </div>
              <div className="flex items-center gap-2 text-body">
                <Users className="size-4 shrink-0 text-ink" aria-hidden />
                {activeBarbers.length} barber
                {activeBarbers.length === 1 ? "" : "s"} on the floor
              </div>
              <div className="flex items-center gap-2 text-body">
                <Clock className="size-4 shrink-0 text-ink" aria-hidden />
                {nextQuery.data
                  ? `Next free ${dayLabel(nextQuery.data.date)} at ${timeLabel(nextQuery.data.time)}`
                  : "No slots in the next 7 days"}
              </div>
            </div>

            <Button asChild className="mt-6 w-full">
              <Link to="/shops/$shopId/book" params={{ shopId }} search={{ step: 1 }}>
                Book an appointment
              </Link>
            </Button>

            <p className="mt-3 text-center text-sm text-muted-foreground">
              You won't be charged yet
            </p>

            <dl className="mt-6 space-y-2.5 border-t border-hairline pt-5 text-sm">
              <div className="flex justify-between text-body">
                <dt className="underline underline-offset-2">Standard cut</dt>
                <dd>{fromPrice !== null ? money(fromPrice) : "—"}</dd>
              </div>
              <div className="flex justify-between text-body">
                <dt className="underline underline-offset-2">Typical duration</dt>
                <dd>{duration(30)}</dd>
              </div>
              <div className="flex justify-between border-t border-hairline pt-3 font-semibold text-ink">
                <dt>Pay at the shop</dt>
                <dd>{fromPrice !== null ? money(fromPrice) : "—"}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>

      {/* Below the rail breakpoint the reservation card becomes a sticky bottom bar. */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-hairline bg-background px-6 py-3 md:bottom-0 lg:hidden">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base text-ink">
              <span className="font-semibold">{fromPrice !== null ? money(fromPrice) : "—"}</span>{" "}
              <span className="text-sm text-muted-foreground">from</span>
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {nextQuery.data ? `Next free ${dayLabel(nextQuery.data.date)}` : "No slots this week"}
            </p>
          </div>
          <Button asChild className="shrink-0">
            <Link to="/shops/$shopId/book" params={{ shopId }} search={{ step: 1 }}>
              Book
            </Link>
          </Button>
        </div>
      </div>
    </CustomerShell>
  );
}
