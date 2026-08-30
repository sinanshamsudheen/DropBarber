import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { dayLabel, money, timeLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Shop } from "@/lib/types";

/*
 * DESIGN.md property-card: a photo-first card. Square photo plate with 14px
 * corner clipping and a swipeable carousel, a floating "Guest favourite" badge
 * top-left, then four lines of meta beneath — title with the ink rating on the
 * right (never a gold star), locality, availability, and the price.
 *
 * The card is flat; the one shadow tier arrives on hover.
 */

/** The rating floor the upstream system uses for its guest-favourite plate. */
const FAVOURITE_RATING = 4.8;

export function ShopCard({
  shop,
  fromPrice,
  next,
}: {
  shop: Shop;
  fromPrice: number | null;
  next: { date: string; time: string } | null;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const photos = shop.photos.length ? shop.photos : [""];

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  return (
    <article className="group relative">
      <div className="relative overflow-hidden rounded-md bg-surface-strong">
        <Carousel setApi={setApi} opts={{ loop: photos.length > 1 }}>
          <CarouselContent className="ml-0">
            {photos.map((photo, i) => (
              <CarouselItem key={i} className="pl-0">
                <img
                  src={photo}
                  alt={i === 0 ? `Inside ${shop.name}` : ""}
                  loading={i === 0 ? "eager" : "lazy"}
                  className="aspect-square w-full object-cover"
                />
              </CarouselItem>
            ))}
          </CarouselContent>

          {photos.length > 1 && (
            <>
              <CarouselPrevious className="left-3 z-20 size-8 border-hairline bg-background/90 opacity-0 shadow-float transition-opacity group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-0" />
              <CarouselNext className="right-3 z-20 size-8 border-hairline bg-background/90 opacity-0 shadow-float transition-opacity group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-0" />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center gap-1.5"
                aria-hidden
              >
                {photos.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "size-1.5 rounded-full transition-colors",
                      i === current ? "bg-white" : "bg-white/60",
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </Carousel>

        {shop.rating >= FAVOURITE_RATING && (
          <Badge variant="favorite" className="absolute left-3 top-3 z-20">
            Guest favourite
          </Badge>
        )}
      </div>

      <div className="pt-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="type-title-md min-w-0 truncate text-ink">{shop.name}</h3>
          {shop.rating > 0 && (
            <span
              className="inline-flex shrink-0 items-center gap-1 text-sm text-ink"
              aria-label={`Rated ${shop.rating.toFixed(1)} out of 5 from ${shop.reviewCount} reviews`}
            >
              <Star className="size-3.5 fill-ink text-ink" aria-hidden />
              {shop.rating.toFixed(1)}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {shop.area} · {shop.distanceKm} km away
        </p>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {next
            ? `Next free ${dayLabel(next.date)} at ${timeLabel(next.time)}`
            : "No slots in the next 7 days"}
        </p>
        {fromPrice !== null && (
          <p className="mt-1.5 text-sm text-ink">
            <span className="font-semibold">{money(fromPrice)}</span>{" "}
            <span className="text-muted-foreground">from</span>
          </p>
        )}
      </div>

      {/* Stretched hit area — sits under the carousel controls. */}
      <Link
        to="/shops/$shopId"
        params={{ shopId: shop.id }}
        className="absolute inset-0 z-10 rounded-md"
      >
        <span className="sr-only">{shop.name}</span>
      </Link>
    </article>
  );
}
