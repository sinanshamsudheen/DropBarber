import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Scissors, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ReferencePhotoUploader } from "@/components/common/photo-uploader";
import { ErrorState, ListSkeleton } from "@/components/common/states";
import {
  ManageHeader,
  RequirePermission,
} from "@/components/layout/manage-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useShopProfile } from "@/hooks/use-shop-profile";
import { updateShopApiV1ShopsShopIdPatch } from "@/lib/api/generated/clients/updateShopApiV1ShopsShopIdPatch";
import { getShopApiV1ShopsShopIdGetQueryKey } from "@/lib/api/generated/hooks/useGetShopApiV1ShopsShopIdGet";
import { listShopMediaApiV1ShopsShopIdMediaGetQueryOptions } from "@/lib/api/generated/hooks/useListShopMediaApiV1ShopsShopIdMediaGet";
import { listShopsApiV1ShopsGetQueryKey } from "@/lib/api/generated/hooks/useListShopsApiV1ShopsGet";
import { getErrorMessage } from "@/lib/api-client";
import { DAY_NAMES } from "@/lib/format";
import type { OpeningHours, Photo } from "@/lib/types";

export const Route = createFileRoute("/manage/$shopId/settings")({
  component: SettingsRoute,
});

function SettingsRoute() {
  const { shopId } = Route.useParams();
  return (
    <RequirePermission shopId={shopId} permission="settings:manage">
      <SettingsPage />
    </RequirePermission>
  );
}

function SettingsPage() {
  const { shopId } = Route.useParams();
  const queryClient = useQueryClient();
  const q = useShopProfile(shopId);
  const mediaQuery = useQuery(
    listShopMediaApiV1ShopsShopIdMediaGetQueryOptions({
      path: { shop_id: shopId },
    }),
  );

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [hours, setHours] = useState<OpeningHours[]>([]);

  useEffect(() => {
    const shop = q.data?.shop;
    if (!shop) return;
    setName(shop.name);
    setTagline(shop.tagline);
    setDescription(shop.description);
    setArea(shop.area);
    setAddress(shop.address);
    setPhone(shop.phone);
    setHours(shop.hours.map((h) => ({ ...h })));
  }, [q.data?.shop]);

  useEffect(() => {
    if (!mediaQuery.data) return;
    setPhotos(mediaQuery.data.data.map((m) => ({ id: m.id, url: m.url })));
  }, [mediaQuery.data]);

  // The backend has no tagline/hours fields to update (tagline is derived
  // from description, opening hours are aggregated from barber working
  // hours) — this was already the case before this migration, so only
  // name/description/phone are sent. Photos are a real, separately-backed
  // shop_photos table now — each one saves immediately on upload/remove via
  // ReferencePhotoUploader's `remote` mode, not through this mutation.
  const save = useMutation({
    mutationFn: () =>
      updateShopApiV1ShopsShopIdPatch({
        path: { shop_id: shopId },
        body: {
          name: name.trim(),
          description: description.trim(),
          phone: phone.trim(),
        },
      }),
    onSuccess: () => {
      toast.success("Shop settings saved");
      void queryClient.invalidateQueries({
        queryKey: getShopApiV1ShopsShopIdGetQueryKey({
          path: { shop_id: shopId },
        }),
      });
      void queryClient.invalidateQueries({
        queryKey: listShopsApiV1ShopsGetQueryKey(),
      });
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  });

  if (q.isPending) return <ListSkeleton rows={4} />;
  if (q.isError)
    return (
      <ErrorState
        message={getErrorMessage(q.error)}
        onRetry={() => void q.refetch()}
      />
    );

  const setDay = (day: number, patch: Partial<OpeningHours>) =>
    setHours((prev) =>
      prev.map((h) => (h.day === day ? { ...h, ...patch } : h)),
    );

  return (
    <div>
      <ManageHeader
        title="Settings"
        description="How your shop appears to customers."
      />

      <div className="space-y-6">
        <section>
          <h2 className="text-base font-semibold">Shop details</h2>
          <div className="mt-3 space-y-3 rounded-md border border-hairline bg-card p-4">
            <div>
              <Label htmlFor="shop-name">Name</Label>
              <Input
                id="shop-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="shop-tagline">Tagline</Label>
              <Input
                id="shop-tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="One line customers see under your name"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="shop-description">Description</Label>
              <Textarea
                id="shop-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1.5 min-h-24"
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold">Photos</h2>
          <p className="text-sm text-muted-foreground">
            The first photo is used on discovery cards. Photos save as soon as
            you add or remove them.
          </p>
          <div className="mt-3">
            <ReferencePhotoUploader
              photos={photos}
              onChange={setPhotos}
              max={5}
              emptyHint="Shops with real photos of the room get booked more."
              remote={{ shopId }}
            />
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold">Location &amp; contact</h2>
          <div className="mt-3 space-y-3 rounded-md border border-hairline bg-card p-4">
            <div>
              <Label htmlFor="shop-area">Neighbourhood</Label>
              <Input
                id="shop-area"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="shop-address">Address</Label>
              <Input
                id="shop-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="shop-phone">Phone</Label>
              <Input
                id="shop-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-2"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Map coordinates come from your address once the backend geocodes
              it.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold">Opening hours</h2>
          <p className="text-sm text-muted-foreground">
            What customers see on your profile. Bookable slots still come from
            each barber's own hours.
          </p>
          <ul className="mt-3 space-y-2">
            {hours.map((h) => {
              const open = h.open !== null && h.close !== null;
              return (
                <li
                  key={h.day}
                  className="rounded-md border border-hairline bg-card p-4"
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                    <h3 className="truncate text-sm font-semibold">
                      {DAY_NAMES[h.day]}
                    </h3>
                    <Switch
                      checked={open}
                      aria-label={`${DAY_NAMES[h.day]} open`}
                      onCheckedChange={(next) =>
                        setDay(
                          h.day,
                          next
                            ? { open: "09:00", close: "18:00" }
                            : { open: null, close: null },
                        )
                      }
                    />
                  </div>
                  {open ? (
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type="time"
                        value={h.open ?? ""}
                        aria-label={`${DAY_NAMES[h.day]} opening time`}
                        onChange={(e) =>
                          setDay(h.day, { open: e.target.value })
                        }
                        className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
                      />
                      <span aria-hidden className="text-muted-foreground">
                        –
                      </span>
                      <input
                        type="time"
                        value={h.close ?? ""}
                        aria-label={`${DAY_NAMES[h.day]} closing time`}
                        onChange={(e) =>
                          setDay(h.day, { close: e.target.value })
                        }
                        className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
                      />
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">Closed</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">Menu &amp; team</h2>
          <div className="mt-3 space-y-2">
            <SettingsLink
              to="/manage/$shopId/services"
              shopId={shopId}
              icon={Store}
              title="Services"
              description="Prices and what's bookable."
            />
            <SettingsLink
              to="/manage/$shopId/barbers"
              shopId={shopId}
              icon={Scissors}
              title="Barbers"
              description="Staff, their services and durations."
            />
          </div>
        </section>

        <Button
          size="lg"
          className="w-full"
          disabled={save.isPending || !name.trim()}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : "Save shop settings"}
        </Button>
      </div>
    </div>
  );
}

function SettingsLink({
  to,
  shopId,
  icon: Icon,
  title,
  description,
}: {
  to: "/manage/$shopId/services" | "/manage/$shopId/barbers";
  shopId: string;
  icon: typeof Store;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      params={{ shopId }}
      className="flex items-center gap-3 rounded-md border border-hairline bg-card p-4 transition-colors hover:border-ink"
    >
      <Icon className="size-5 shrink-0 text-ink" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="truncate text-sm text-muted-foreground">{description}</p>
      </div>
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
    </Link>
  );
}
