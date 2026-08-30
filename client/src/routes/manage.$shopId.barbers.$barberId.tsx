import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CalendarRange, Pencil, Timer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BarberAvatar } from "@/components/cards/barber-card";
import { Rating } from "@/components/common/rating";
import { ErrorState, ListSkeleton } from "@/components/common/states";
import {
  ManageHeader,
  RequirePermission,
} from "@/components/layout/manage-shell";
import { BarberFormDialog } from "@/components/manage/barber-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useManagedBarber } from "@/hooks/use-managed-barber";
import { setBarberServiceApiV1ShopsShopIdBarbersBarberIdServicesServiceIdPut } from "@/lib/api/generated/clients/setBarberServiceApiV1ShopsShopIdBarbersBarberIdServicesServiceIdPut";
import { getManagedBarberApiV1ShopsShopIdBarbersBarberIdGetQueryKey } from "@/lib/api/generated/hooks/useGetManagedBarberApiV1ShopsShopIdBarbersBarberIdGet";
import { listShopBarbersApiV1ShopsShopIdBarbersGetQueryKey } from "@/lib/api/generated/hooks/useListShopBarbersApiV1ShopsShopIdBarbersGet";
import { getErrorMessage } from "@/lib/api-client";
import { money } from "@/lib/format";
import type { Service } from "@/lib/types";

export const Route = createFileRoute("/manage/$shopId/barbers/$barberId")({
  component: BarberDetailRoute,
});

function BarberDetailRoute() {
  const { shopId } = Route.useParams();
  return (
    <RequirePermission shopId={shopId} permission="barbers:manage">
      <BarberDetail />
    </RequirePermission>
  );
}

function BarberDetail() {
  const { shopId, barberId } = Route.useParams();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

  const q = useManagedBarber(shopId, barberId);

  if (q.isPending) return <ListSkeleton rows={4} />;
  if (q.isError || !q.data)
    return (
      <ErrorState
        message={getErrorMessage(q.error)}
        onRetry={() => void q.refetch()}
      />
    );

  const { barber, services } = q.data;

  return (
    <div className="space-y-6">
      <button
        onClick={() =>
          void navigate({ to: "/manage/$shopId/barbers", params: { shopId } })
        }
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Barbers
      </button>

      <ManageHeader
        title={barber.name}
        description={barber.active ? "Taking bookings" : "Not taking bookings"}
        action={
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" aria-hidden /> Edit
          </Button>
        }
      />

      <BarberFormDialog
        shopId={shopId}
        barber={barber}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <section className="flex items-start gap-4 rounded-md border border-hairline bg-card p-4">
        <BarberAvatar barber={barber} className="size-16" />
        <div className="min-w-0 flex-1">
          <Rating value={barber.rating} count={barber.reviewCount} size="md" />
          <p className="mt-1.5 text-sm text-muted-foreground">
            {barber.bio || "No bio yet."}
          </p>
          <p className="mt-2 text-sm font-medium text-ink">
            {barber.points} points
          </p>
        </div>
      </section>

      <section>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">
              Services &amp; durations
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Duration is per barber — {barber.name} may be quicker or slower
              than the rest of the team, and availability is calculated from
              this number.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link
              to="/manage/$shopId/schedule"
              params={{ shopId }}
              search={{ barberId }}
            >
              <CalendarRange className="size-4" aria-hidden /> Hours
            </Link>
          </Button>
        </div>

        <ul className="mt-3 space-y-2">
          {services.map((service) => (
            <ServiceRow
              key={service.id}
              shopId={shopId}
              barberId={barberId}
              service={service}
              assigned={
                barber.services.find((s) => s.serviceId === service.id) ?? null
              }
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function ServiceRow({
  shopId,
  barberId,
  service,
  assigned,
}: {
  shopId: string;
  barberId: string;
  service: Service;
  assigned: {
    durationMin: number;
    priceOverride?: number | undefined;
    active: boolean;
  } | null;
}) {
  const queryClient = useQueryClient();
  const [durationInput, setDurationInput] = useState(
    String(assigned?.durationMin ?? 20),
  );
  const [priceInput, setPriceInput] = useState(
    assigned?.priceOverride != null ? String(assigned.priceOverride) : "",
  );

  // The backend's PUT config endpoint is a full replace, so a partial patch
  // (e.g. just a new duration) is merged over the barber's current config —
  // already in hand as the `assigned` prop — before sending.
  const patch = useMutation({
    mutationFn: (
      next: Partial<{
        durationMin: number;
        priceOverride: number | undefined;
        active: boolean;
      }>,
    ) =>
      setBarberServiceApiV1ShopsShopIdBarbersBarberIdServicesServiceIdPut({
        path: { shop_id: shopId, barber_id: barberId, service_id: service.id },
        body: {
          is_active: next.active ?? assigned?.active ?? true,
          duration_minutes: next.durationMin ?? assigned?.durationMin ?? 20,
          price_override:
            ("priceOverride" in next
              ? next.priceOverride
              : assigned?.priceOverride) ?? null,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: getManagedBarberApiV1ShopsShopIdBarbersBarberIdGetQueryKey({
          path: { shop_id: shopId, barber_id: barberId },
        }),
      });
      void queryClient.invalidateQueries({
        queryKey: listShopBarbersApiV1ShopsShopIdBarbersGetQueryKey({
          path: { shop_id: shopId },
        }),
      });
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  });

  const active = assigned?.active ?? false;
  const durationId = `duration-${service.id}`;
  const priceId = `price-${service.id}`;

  const commitDuration = () => {
    const value = Number(durationInput);
    if (!Number.isFinite(value) || value < 5) {
      setDurationInput(String(assigned?.durationMin ?? 20));
      toast.error("Duration must be at least 5 minutes.");
      return;
    }
    if (value === assigned?.durationMin) return;
    patch.mutate({ durationMin: value });
  };

  const commitPrice = () => {
    const trimmed = priceInput.trim();
    const value = trimmed === "" ? undefined : Number(trimmed);
    if (value === assigned?.priceOverride) return;
    patch.mutate({ priceOverride: value });
  };

  return (
    <li className="rounded-md border border-hairline bg-card p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{service.name}</p>
          <p className="truncate text-sm text-muted-foreground">
            Shop price {money(service.price)}
          </p>
        </div>
        <Switch
          checked={active}
          aria-label={`${service.name} offered by this barber`}
          onCheckedChange={(next) =>
            patch.mutate({
              active: next,
              durationMin:
                assigned?.durationMin ?? (Number(durationInput) || 20),
            })
          }
        />
      </div>

      {active && (
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-hairline pt-3">
          <div>
            <label
              htmlFor={durationId}
              className="text-sm font-medium text-muted-foreground"
            >
              Minutes for this barber
            </label>
            <div className="relative mt-1.5">
              <Timer
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id={durationId}
                inputMode="numeric"
                value={durationInput}
                onChange={(e) =>
                  setDurationInput(e.target.value.replace(/[^\d]/g, ""))
                }
                onBlur={commitDuration}
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor={priceId}
              className="text-sm font-medium text-muted-foreground"
            >
              Price override (₹)
            </label>
            <Input
              id={priceId}
              inputMode="numeric"
              value={priceInput}
              placeholder={String(service.price)}
              onChange={(e) =>
                setPriceInput(e.target.value.replace(/[^\d]/g, ""))
              }
              onBlur={commitPrice}
              className="mt-2"
            />
          </div>
        </div>
      )}
    </li>
  );
}
