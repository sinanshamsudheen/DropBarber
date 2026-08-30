import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { ReviewCard } from "@/components/cards/review-card";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { ManageHeader, RequirePermission } from "@/components/layout/manage-shell";
import { Progress } from "@/components/ui/progress";
import { listShopReviews } from "@/lib/api";
import { barbers } from "@/lib/mock-data";

export const Route = createFileRoute("/manage/$shopId/reviews")({
  component: ReviewsRoute,
});

function ReviewsRoute() {
  const { shopId } = Route.useParams();
  return (
    <RequirePermission shopId={shopId} permission="reviews:view">
      <ReviewsPage />
    </RequirePermission>
  );
}

function ReviewsPage() {
  const { shopId } = Route.useParams();
  const q = useQuery({
    queryKey: ["shop-reviews", shopId],
    queryFn: () => listShopReviews(shopId),
  });

  return (
    <div>
      <ManageHeader
        title="Reviews"
        description="Left by customers after a completed appointment."
      />

      {q.isPending && <ListSkeleton rows={3} />}
      {q.isError && (
        <ErrorState message={(q.error as Error).message} onRetry={() => void q.refetch()} />
      )}

      {q.data && q.data.total === 0 && (
        <EmptyState
          icon={Star}
          title="No reviews yet"
          description="Reviews appear here once customers rate a visit they've completed with you."
        />
      )}

      {q.data && q.data.total > 0 && (
        <div className="space-y-6">
          <section className="grid gap-5 rounded-md border border-hairline bg-card p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <div className="text-center sm:text-left">
              <p className="font-semibold text-4xl font-semibold">{q.data.average.toFixed(1)}</p>
              <p className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground sm:justify-start">
                <Star className="size-3.5 fill-ink text-ink" aria-hidden />
                {q.data.total} review{q.data.total === 1 ? "" : "s"}
              </p>
            </div>
            <ul className="space-y-1.5">
              {q.data.distribution.map((row) => (
                <li key={row.star} className="flex items-center gap-3">
                  <span className="w-8 shrink-0 text-sm text-muted-foreground">{row.star}★</span>
                  <Progress
                    value={q.data.total ? (row.count / q.data.total) * 100 : 0}
                    className="h-2 flex-1"
                    aria-label={`${row.count} of ${q.data.total} reviews rated ${row.star} stars`}
                  />
                  <span className="w-6 shrink-0 text-right text-sm text-muted-foreground">
                    {row.count}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 type-display-sm text-ink">Recent reviews</h2>
            <ul className="space-y-3">
              {q.data.reviews.map((review) => (
                <li key={review.id}>
                  <ReviewCard
                    review={review}
                    barberName={barbers.find((b) => b.id === review.barberId)?.name}
                  />
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
