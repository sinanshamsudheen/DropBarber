import { Link } from "@tanstack/react-router";
import { Clock, MapPin } from "lucide-react";
import { Rating } from "@/components/common/rating";
import { dayLabel, money, timeLabel } from "@/lib/format";
import type { Shop } from "@/lib/types";

export function ShopCard({
  shop,
  fromPrice,
  next,
}: {
  shop: Shop;
  fromPrice: number | null;
  next: { date: string; time: string } | null;
}) {
  return (
    <Link
      to="/shops/$shopId"
      params={{ shopId: shop.id }}
      className="group block overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-raised)]"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-secondary">
        <img
          src={shop.photos[0]}
          alt={`Inside ${shop.name}`}
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {fromPrice !== null && (
          <span className="absolute bottom-2 left-2 rounded-full bg-background/92 px-2.5 py-1 text-xs font-semibold backdrop-blur">
            from {money(fromPrice)}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">{shop.name}</h3>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              {shop.area} · {shop.distanceKm} km
            </p>
          </div>
          <Rating value={shop.rating} count={shop.reviewCount} className="shrink-0 pt-0.5" />
        </div>
        <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">{shop.tagline}</p>
        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium">
          <Clock className="size-3.5 text-accent" aria-hidden />
          {next ? (
            <span>
              Next available {dayLabel(next.date)} at {timeLabel(next.time)}
            </span>
          ) : (
            <span className="text-muted-foreground">No slots in the next 7 days</span>
          )}
        </p>
      </div>
    </Link>
  );
}
