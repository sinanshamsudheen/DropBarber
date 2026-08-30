import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Clock, MapPin, Phone, Star } from "lucide-react";
import { BarberAvatar } from "@/components/cards/barber-card";
import { ReviewCard } from "@/components/cards/review-card";
import { ServiceCard } from "@/components/cards/service-card";
import { Rating } from "@/components/common/rating";
import { CardSkeleton, ErrorState, ListSkeleton } from "@/components/common/states";
import { CustomerShell } from "@/components/layout/customer-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getShop, nextAvailable } from "@/lib/api";
import { DAY_NAMES, dayLabel, duration, timeLabel } from "@/lib/format";

export const Route = createFileRoute("/shops/$shopId/")({
  head: () => ({
    meta: [
      { title: "Barber shop profile — Drop" },
      { name: "description", content: "See services, barbers, prices, opening hours and reviews, then book." },
      { property: "og:title", content: "Barber shop profile — Drop" },
      { property: "og:description", content: "Services, barbers, prices and reviews — book in a few taps." },
    ],
  }),
  component: ShopProfile,
});

function ShopProfile() {
  const { shopId } = Route.useParams();
  const navigate = useNavigate();

  const shopQuery = useQuery({ queryKey: ["shop", shopId], queryFn: () => getShop(shopId) });
  const nextQuery = useQuery({ queryKey: ["next", shopId], queryFn: () => nextAvailable(shopId) });

  if (shopQuery.isPending) {
    return (
      <CustomerShell>
        <div className="page space-y-4 pt-4">
          <CardSkeleton lines={2} />
          <ListSkeleton rows={3} />
        </div>
      </CustomerShell>
    );
  }

  if (shopQuery.isError) {
    return (
      <CustomerShell>
        <div className="page pt-6">
          <ErrorState message={(shopQuery.error as Error).message} onRetry={() => void shopQuery.refetch()} />
        </div>
      </CustomerShell>
    );
  }

  const { shop, services, barbers, reviews } = shopQuery.data;
  const activeServices = services.filter((s) => s.active);
  const activeBarbers = barbers.filter((b) => b.active);
  const today = new Date().getDay();

  return (
    <CustomerShell className="pb-36">
      <div className="relative">
        <img
          src={shop.photos[0]}
          alt={`Inside ${shop.name}`}
          width={1024}
          height={768}
          className="h-56 w-full object-cover sm:h-72"
        />
        <Button
          variant="secondary"
          size="icon"
          aria-label="Go back"
          onClick={() => void navigate({ to: "/" })}
          className="absolute left-4 top-4 size-10 rounded-full shadow-sm"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="page -mt-8">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold">{shop.name}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">{shop.tagline}</p>
            </div>
            <Rating value={shop.rating} count={shop.reviewCount} size="md" className="shrink-0" />
          </div>
          <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span>
                {shop.address} · {shop.distanceKm} km away
              </span>
            </p>
            <p className="flex items-center gap-2">
              <Clock className="size-4 shrink-0 text-accent" aria-hidden />
              {shop.hours[today]?.open
                ? `Open today ${timeLabel(shop.hours[today]!.open!)} – ${timeLabel(shop.hours[today]!.close!)}`
                : "Closed today"}
            </p>
            <p className="flex items-center gap-2">
              <Phone className="size-4 shrink-0 text-accent" aria-hidden />
              {shop.phone}
            </p>
            {nextQuery.data && (
              <p className="flex items-center gap-2 font-medium text-foreground">
                <Star className="size-4 shrink-0 text-accent" aria-hidden />
                Next available {dayLabel(nextQuery.data.date)} at {timeLabel(nextQuery.data.time)}
              </p>
            )}
          </div>
        </div>

        <Tabs defaultValue="services" className="mt-5">
          <TabsList className="w-full">
            <TabsTrigger value="services" className="flex-1">
              Services
            </TabsTrigger>
            <TabsTrigger value="barbers" className="flex-1">
              Barbers
            </TabsTrigger>
            <TabsTrigger value="about" className="flex-1">
              About
            </TabsTrigger>
            <TabsTrigger value="reviews" className="flex-1">
              Reviews
            </TabsTrigger>
          </TabsList>

          <TabsContent value="services" className="space-y-3 pt-4">
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
          </TabsContent>

          <TabsContent value="barbers" className="space-y-3 pt-4">
            {activeBarbers.map((barber) => (
              <Link
                key={barber.id}
                to="/shops/$shopId/barbers/$barberId"
                params={{ shopId, barberId: barber.id }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-colors hover:border-accent/50"
              >
                <BarberAvatar barber={barber} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{barber.name}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{barber.bio}</p>
                  <div className="mt-1 flex items-center gap-3">
                    <Rating value={barber.rating} count={barber.reviewCount} />
                    <span className="text-xs text-muted-foreground">
                      {barber.services.filter((s) => s.active).length} services
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </TabsContent>

          <TabsContent value="about" className="space-y-4 pt-4">
            <p className="text-sm leading-relaxed text-foreground/90">{shop.description}</p>
            <div className="overflow-hidden rounded-2xl border border-border">
              <h2 className="border-b border-border bg-secondary/60 px-4 py-2.5 text-sm font-semibold">
                Opening hours
              </h2>
              <ul className="divide-y divide-border">
                {shop.hours.map((h) => (
                  <li
                    key={h.day}
                    className={`flex items-center justify-between px-4 py-2 text-sm ${h.day === today ? "bg-accent/5 font-medium" : ""}`}
                  >
                    <span>{DAY_NAMES[h.day]}</span>
                    <span className="text-muted-foreground">
                      {h.open ? `${timeLabel(h.open)} – ${timeLabel(h.close!)}` : "Closed"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {shop.photos.slice(1).map((p, i) => (
                <img
                  key={i}
                  src={p}
                  alt={`${shop.name} photo ${i + 2}`}
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded-xl object-cover"
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="reviews" className="space-y-3 pt-4">
            {reviews.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No reviews yet. Reviews appear here after a completed appointment.
              </p>
            ) : (
              reviews.map((r) => (
                <ReviewCard
                  key={r.id}
                  review={r}
                  barberName={barbers.find((b) => b.id === r.barberId)?.name}
                />
              ))
            )}
          </TabsContent>
        </Tabs>

        <p className="mt-6 text-xs text-muted-foreground">
          Prices shown are the shop's standard price. Each barber sets their own {duration(20)}-ish timing per
          service — you'll see the exact duration when you pick a barber.
        </p>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">
              {activeBarbers.length} barbers · {activeServices.length} services
            </p>
          </div>
          <Button asChild size="lg" className="h-12 flex-1 rounded-xl">
            <Link to="/shops/$shopId/book" params={{ shopId }} search={{ step: 1 }}>
              Book
            </Link>
          </Button>
        </div>
      </div>
    </CustomerShell>
  );
}
