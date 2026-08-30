import { Rating } from "@/components/common/rating";
import { dayLabel } from "@/lib/format";
import type { Review } from "@/lib/types";

export function ReviewCard({
  review,
  barberName,
}: {
  review: Review;
  barberName?: string | undefined;
}) {
  return (
    <article className="rounded-md border border-hairline bg-card p-4 sm:p-5 md:p-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="type-title-md truncate text-ink">{review.customerName}</p>
          <p className="text-sm text-muted-foreground">
            {dayLabel(review.date)}
            {barberName ? ` · ${barberName}` : ""}
          </p>
        </div>
        <Rating value={review.shopRating} />
      </div>
      <p className="mt-3 text-base leading-relaxed text-body">{review.text}</p>
    </article>
  );
}
