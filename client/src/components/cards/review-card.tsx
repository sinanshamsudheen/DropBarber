import { Rating } from "@/components/common/rating";
import { dayLabel } from "@/lib/format";
import type { Review } from "@/lib/types";

export function ReviewCard({ review, barberName }: { review: Review; barberName?: string | undefined }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{review.customerName}</p>
          <p className="text-xs text-muted-foreground">
            {dayLabel(review.date)}
            {barberName ? ` · ${barberName}` : ""}
          </p>
        </div>
        <Rating value={review.shopRating} />
      </div>
      <p className="mt-2.5 text-sm leading-relaxed text-foreground/90">{review.text}</p>
    </article>
  );
}
