import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Plus, Scissors } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BarberAvatar } from "@/components/cards/barber-card";
import { Rating } from "@/components/common/rating";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { ManageHeader, RequirePermission } from "@/components/layout/manage-shell";
import { BarberFormDialog } from "@/components/manage/barber-form-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { listBarbers, setBarberActive } from "@/lib/api";

export const Route = createFileRoute("/manage/$shopId/barbers/")({
  component: BarbersRoute,
});

function BarbersRoute() {
  const { shopId } = Route.useParams();
  return (
    <RequirePermission shopId={shopId} permission="barbers:manage">
      <BarbersPage />
    </RequirePermission>
  );
}

function BarbersPage() {
  const { shopId } = Route.useParams();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const q = useQuery({ queryKey: ["barbers", shopId], queryFn: () => listBarbers(shopId) });

  const toggle = useMutation({
    mutationFn: ({ barberId, active }: { barberId: string; active: boolean }) =>
      setBarberActive(barberId, active),
    onSuccess: (barber) => {
      toast.success(`${barber.name} is now ${barber.active ? "taking bookings" : "inactive"}`);
      void queryClient.invalidateQueries({ queryKey: ["barbers", shopId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <ManageHeader
        title="Barbers"
        description="Who's on the floor, what they do, and how long they take."
        action={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" aria-hidden /> Add
          </Button>
        }
      />

      <BarberFormDialog shopId={shopId} open={addOpen} onOpenChange={setAddOpen} />

      {q.isPending && <ListSkeleton rows={4} />}
      {q.isError && (
        <ErrorState message={(q.error as Error).message} onRetry={() => void q.refetch()} />
      )}
      {q.isSuccess && q.data.length === 0 && (
        <EmptyState
          icon={Scissors}
          title="No barbers yet"
          description="Add your first barber so customers can start booking with them."
          action={<Button onClick={() => setAddOpen(true)}>Add a barber</Button>}
        />
      )}

      <ul className="space-y-2">
        {q.data?.map(({ barber, todayCount }) => (
          <li
            key={barber.id}
            className="rounded-2xl border border-border bg-card p-3.5 transition-colors hover:border-accent/40"
          >
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
              <BarberAvatar barber={barber} />
              <Link
                to="/manage/$shopId/barbers/$barberId"
                params={{ shopId, barberId: barber.id }}
                className="min-w-0"
              >
                <p className="truncate text-sm font-semibold">{barber.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {barber.services.filter((s) => s.active).length} service
                  {barber.services.filter((s) => s.active).length === 1 ? "" : "s"} · {todayCount}{" "}
                  today
                </p>
                <div className="mt-1 flex items-center gap-3">
                  <Rating value={barber.rating} count={barber.reviewCount} />
                  {!barber.active && (
                    <span className="text-xs font-medium text-muted-foreground">
                      Not taking bookings
                    </span>
                  )}
                </div>
              </Link>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
              <label
                htmlFor={`active-${barber.id}`}
                className="text-xs font-medium text-muted-foreground"
              >
                Taking bookings
              </label>
              <Switch
                id={`active-${barber.id}`}
                checked={barber.active}
                disabled={toggle.isPending}
                onCheckedChange={(active) => toggle.mutate({ barberId: barber.id, active })}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
