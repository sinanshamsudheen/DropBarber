import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { BarberAvatar } from "@/components/cards/barber-card";
import { ReviewCard } from "@/components/cards/review-card";
import { Rating } from "@/components/common/rating";
import { ErrorState, ListSkeleton } from "@/components/common/states";
import { CustomerShell } from "@/components/layout/customer-shell";
import { Button } from "@/components/ui/button";
import { getAvailability, getBarber } from "@/lib/api";
import { addDaysISO, duration, money, timeLabel, todayISO } from "@/lib/format";

export const Route = createFileRoute("/shops/$shopId/barbers/$barberId")({
  head: () => ({
    meta: [
      { title: "Barber profile — Drop" },
      { name: "description", content: "See a barber's services, timings, rating and next available slots." },
      { property: "og:title", content: "Barber profile — Drop" },
      { property: "og:description", content: "Services, timings and availability for this barber." },
    ],
  }),
  component: BarberProfile,
});

function BarberProfile() {
  const { shopId, barberId } = Route.useParams();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["barber", shopId, barberId], queryFn: () => getBarber(shopId, barberId) });

  const firstService = q.data?.barber.services.find((s) => s.active);
  const slotsQuery = useQuery({
    queryKey: ["barber-slots", barberId, firstService?.serviceId],
    enabled: !!firstService,
    queryFn: () =>
      getAvailability({ shopId, barberId, serviceId: firstService!.serviceId, date: todayISO() }),
  });
  const tomorrowQuery = useQuery({
    queryKey: ["barber-slots-tmw", barberId, firstService?.serviceId],
    enabled: !!firstService,
    queryFn: () =>
      getAvailability({ shopId, barberId, serviceId: firstService!.serviceId, date: addDaysISO(1) }),
  });

  if (q.isPending) {
    return (
      <CustomerShell>
        <div className="page pt-6">
          <ListSkeleton rows={4} />
        </div>
      </CustomerShell>
    );
  }
  if (q.isError) {
    return (
      <CustomerShell>
        <div className="page pt-6">
          <ErrorState message={(q.error as Error).message} onRetry={() => void q.refetch()} />
        </div>
      </CustomerShell>
    );
  }

  const { barber, shop, services, reviews } = q.data;
  const offered = barber.services.filter((s) => s.active);

  return (
    <CustomerShell className="pb-32">
      <div className="page pt-4">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          onClick={() => void navigate({ to: "/shops/$shopId", params: { shopId } })}
        >
          <ArrowLeft className="size-4" aria-hidden /> {shop.name}
        </Button>

        <div className="mt-3 flex items-center gap-4">
          <BarberAvatar barber={barber} className="size-20" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">{barber.name}</h1>
            <Rating value={barber.rating} count={barber.reviewCount} size="md" className="mt-1" />
            <p className="mt-1 text-xs text-muted-foreground">{shop.name}</p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-foreground/90">{barber.bio}</p>

        <h2 className="mt-6 text-base font-semibold">Services &amp; timings</h2>
        <p className="text-xs text-muted-foreground">Timings are specific to {barber.name.split(" ")[0]}.</p>
        <ul className="mt-3 space-y-2.5">
          {offered.map((bs) => {
            const service = services.find((s) => s.id === bs.serviceId);
            if (!service) return null;
            return (
              <li
                key={bs.serviceId}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{service.name}</p>
                  <p className="text-xs text-muted-foreground">{duration(bs.durationMin)}</p>
                </div>
                <span className="text-sm font-semibold">{money(bs.priceOverride ?? service.price)}</span>
              </li>
            );
          })}
        </ul>

        <h2 className="mt-6 text-base font-semibold">Next available</h2>
        <div className="mt-3 space-y-3">
          {[
            { label: "Today", data: slotsQuery.data, loading: slotsQuery.isPending },
            { label: "Tomorrow", data: tomorrowQuery.data, loading: tomorrowQuery.isPending },
          ].map((group) => (
            <div key={group.label} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-medium">{group.label}</p>
              {group.loading ? (
                <p className="mt-2 text-xs text-muted-foreground">Checking availability…</p>
              ) : group.data?.slots.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {group.data.slots.slice(0, 8).map((s) => (
                    <span
                      key={s.time}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium"
                    >
                      {timeLabel(s.time)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">No available times.</p>
              )}
            </div>
          ))}
        </div>

        {reviews.length > 0 && (
          <>
            <h2 className="mt-6 text-base font-semibold">Reviews</h2>
            <div className="mt-3 space-y-3">
              {reviews.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <Button asChild size="lg" className="h-12 w-full rounded-xl">
            <Link to="/shops/$shopId/book" params={{ shopId }} search={{ step: 1, barberId }}>
              Book with {barber.name.split(" ")[0]}
            </Link>
          </Button>
        </div>
      </div>
    </CustomerShell>
  );
}
