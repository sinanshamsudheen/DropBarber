import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { BarberAvatar } from "@/components/cards/barber-card";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { ManageHeader } from "@/components/layout/manage-shell";
import { getBarberPoints } from "@/lib/api";
import { dayLabel } from "@/lib/format";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/manage/$shopId/points")({
  component: PointsPage,
});

function PointsPage() {
  const { shopId } = Route.useParams();
  const { membershipFor, can } = useSession();
  const ownBarberId = membershipFor(shopId)?.barberId;
  const seesEveryone = can(shopId, "points:view_all");

  const q = useQuery({
    queryKey: ["barber-points", shopId],
    queryFn: () => getBarberPoints(shopId),
  });

  const rows = (q.data ?? []).filter((r) => seesEveryone || r.barber.id === ownBarberId);

  return (
    <div>
      <ManageHeader
        title="Points"
        description={
          seesEveryone
            ? "Points barbers earn for completing a customer record after a service."
            : "Points you earn for completing a customer record after a service."
        }
      />

      <p className="mb-4 rounded-2xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
        Completing the detailed record earns 10 points. Skipping it is always fine — the record is
        worth more to the shop than the points are to anyone.
      </p>

      {q.isPending && <ListSkeleton rows={3} />}
      {q.isError && (
        <ErrorState message={(q.error as Error).message} onRetry={() => void q.refetch()} />
      )}
      {q.isSuccess && rows.length === 0 && (
        <EmptyState
          icon={Trophy}
          title="No points yet"
          description="Points appear after the first completed service record."
        />
      )}

      <ul className="space-y-3">
        {rows.map(({ barber, history }) => (
          <li key={barber.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
              <BarberAvatar barber={barber} className="size-11" />
              <p className="min-w-0 truncate text-sm font-semibold">{barber.name}</p>
              <span className="shrink-0 text-sm font-semibold text-accent">
                {barber.points} pts
              </span>
            </div>

            {history.length === 0 ? (
              <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                No point history yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
                {history.slice(0, 5).map((entry) => (
                  <li key={entry.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-xs">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {entry.reason} · {dayLabel(entry.date)}
                    </span>
                    <span className="shrink-0 font-medium">+{entry.points}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
