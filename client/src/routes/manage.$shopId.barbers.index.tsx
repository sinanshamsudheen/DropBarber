import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Plus, Scissors } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BarberAvatar } from "@/components/cards/barber-card";
import { Rating } from "@/components/common/rating";
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
} from "@/components/common/states";
import {
  ManageHeader,
  RequirePermission,
} from "@/components/layout/manage-shell";
import { BarberFormDialog } from "@/components/manage/barber-form-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useShopBarbers } from "@/hooks/use-shop-barbers";
import { deactivateBarberApiV1ShopsShopIdBarbersBarberIdDeactivatePost } from "@/lib/api/generated/clients/deactivateBarberApiV1ShopsShopIdBarbersBarberIdDeactivatePost";
import { getManagedBarberApiV1ShopsShopIdBarbersBarberIdGet } from "@/lib/api/generated/clients/getManagedBarberApiV1ShopsShopIdBarbersBarberIdGet";
import { removeBarberApiV1ShopsShopIdBarbersBarberIdRemovePost } from "@/lib/api/generated/clients/removeBarberApiV1ShopsShopIdBarbersBarberIdRemovePost";
import { listShopBarbersApiV1ShopsShopIdBarbersGetQueryKey } from "@/lib/api/generated/hooks/useListShopBarbersApiV1ShopsShopIdBarbersGet";
import { getErrorMessage } from "@/lib/api-client";
import { mapManagedBarber } from "@/lib/domain-mappers";

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

  const q = useShopBarbers(shopId);

  // The backend only exposes a deactivate route (no "reactivate") — toggling
  // back on refetches the barber but its status stays whatever the backend
  // last recorded, matching this real backend limitation rather than
  // inventing a reactivate endpoint.
  const toggle = useMutation({
    mutationFn: async ({
      barberId,
      active,
    }: {
      barberId: string;
      active: boolean;
    }) => {
      if (!active) {
        await deactivateBarberApiV1ShopsShopIdBarbersBarberIdDeactivatePost({
          path: { shop_id: shopId, barber_id: barberId },
        });
      }
      const { data } = await getManagedBarberApiV1ShopsShopIdBarbersBarberIdGet(
        {
          path: { shop_id: shopId, barber_id: barberId },
        },
      );
      return mapManagedBarber(data.data);
    },
    onSuccess: (barber) => {
      toast.success(
        `${barber.name} is now ${barber.active ? "taking bookings" : "inactive"}`,
      );
      void queryClient.invalidateQueries({
        queryKey: listShopBarbersApiV1ShopsShopIdBarbersGetQueryKey({
          path: { shop_id: shopId },
        }),
      });
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: async (barberId: string) => {
      await removeBarberApiV1ShopsShopIdBarbersBarberIdRemovePost({
        path: { shop_id: shopId, barber_id: barberId },
      });
    },
    onSuccess: () => {
      toast.success("Barber removed from the team");
      void queryClient.invalidateQueries({
        queryKey: listShopBarbersApiV1ShopsShopIdBarbersGetQueryKey({
          path: { shop_id: shopId },
        }),
      });
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
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

      <BarberFormDialog
        shopId={shopId}
        open={addOpen}
        onOpenChange={setAddOpen}
      />

      {q.isPending && <ListSkeleton rows={4} />}
      {q.isError && (
        <ErrorState
          message={getErrorMessage(q.error)}
          onRetry={() => void q.refetch()}
        />
      )}
      {q.data?.length === 0 && (
        <EmptyState
          icon={Scissors}
          title="No barbers yet"
          description="Add your first barber so customers can start booking with them."
          action={
            <Button onClick={() => setAddOpen(true)}>Add a barber</Button>
          }
        />
      )}

      <ul className="space-y-2">
        {q.data?.map(({ barber, todayCount }) => (
          <li
            key={barber.id}
            className="rounded-md border border-hairline bg-card p-3.5 transition-colors hover:border-ink"
          >
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
              <BarberAvatar barber={barber} />
              <Link
                to="/manage/$shopId/barbers/$barberId"
                params={{ shopId, barberId: barber.id }}
                className="min-w-0"
              >
                <p className="truncate text-sm font-semibold">{barber.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {barber.services.filter((s) => s.active).length} service
                  {barber.services.filter((s) => s.active).length === 1
                    ? ""
                    : "s"}{" "}
                  · {todayCount} today
                </p>
                <div className="mt-1 flex items-center gap-3">
                  <Rating value={barber.rating} count={barber.reviewCount} />
                  {!barber.active && (
                    <span className="text-sm font-medium text-muted-foreground">
                      Not taking bookings
                    </span>
                  )}
                </div>
              </Link>
              <ChevronRight
                className="size-4 text-muted-foreground"
                aria-hidden
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-hairline pt-3">
              <label
                htmlFor={`active-${barber.id}`}
                className="text-sm font-medium text-muted-foreground"
              >
                Taking bookings
              </label>
              <div className="flex items-center gap-3">
                <Switch
                  id={`active-${barber.id}`}
                  checked={barber.active}
                  disabled={toggle.isPending}
                  onCheckedChange={(active) =>
                    toggle.mutate({ barberId: barber.id, active })
                  }
                />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                    >
                      Remove
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove {barber.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        They'll lose access to this shop's manage workspace and
                        stop appearing to customers. This can't be undone from
                        here — they'd need to be re-added.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep them</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => remove.mutate(barber.id)}
                      >
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
