import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ReferencePhotoUploader } from "@/components/common/photo-uploader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createBarberApiV1ShopsShopIdBarbersPost } from "@/lib/api/generated/clients/createBarberApiV1ShopsShopIdBarbersPost";
import { getManagedBarberApiV1ShopsShopIdBarbersBarberIdGet } from "@/lib/api/generated/clients/getManagedBarberApiV1ShopsShopIdBarbersBarberIdGet";
import { lookupBarberCandidateApiV1ShopsShopIdBarbersLookupGet } from "@/lib/api/generated/clients/lookupBarberCandidateApiV1ShopsShopIdBarbersLookupGet";
import { updateBarberApiV1ShopsShopIdBarbersBarberIdPatch } from "@/lib/api/generated/clients/updateBarberApiV1ShopsShopIdBarbersBarberIdPatch";
import type { BarberLookupOut } from "@/lib/api/generated/types/BarberLookupOut";
import { getErrorCode, getErrorMessage } from "@/lib/api-client";
import type { Barber, Photo } from "@/lib/types";

/** Add or edit a barber. Kept short on purpose — onboarding should be fast. */
export function BarberFormDialog({
  shopId,
  barber,
  open,
  onOpenChange,
}: {
  shopId: string;
  barber?: Barber | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [matched, setMatched] = useState<BarberLookupOut | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(barber?.name ?? "");
    setBio(barber?.bio ?? "");
    setPhotos(barber?.photo ? [{ id: "current", url: barber.photo }] : []);
    setError(null);
    setEmail("");
    setMatched(null);
  }, [open, barber]);

  const lookup = useMutation({
    mutationFn: async () => {
      const { data } =
        await lookupBarberCandidateApiV1ShopsShopIdBarbersLookupGet({
          path: { shop_id: shopId },
          query: { email: email.trim() },
        });
      return data.data;
    },
    onSuccess: (found) => {
      setMatched(found);
      setName(found.display_name ?? "");
    },
    onError: (e: unknown) => {
      const code = getErrorCode(e);
      if (code === "NOT_FOUND")
        toast.error("No account found with that email.");
      else if (code === "CONFLICT")
        toast.error("That person is already on your team.");
      else toast.error(getErrorMessage(e));
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!barber) {
        if (!matched) throw new Error("Look up the barber's email first.");
        const { data } = await createBarberApiV1ShopsShopIdBarbersPost({
          path: { shop_id: shopId },
          body: {
            user_id: matched.user_id,
            display_name: name.trim(),
            bio: bio.trim() || null,
            profile_image_url: photos[0]?.url ?? null,
          },
        });
        return data.data;
      }
      await updateBarberApiV1ShopsShopIdBarbersBarberIdPatch({
        path: { shop_id: shopId, barber_id: barber.id },
        body: {
          display_name: name.trim(),
          bio: bio.trim() || null,
          profile_image_url: photos[0]?.url ?? null,
        },
      });
      const { data } = await getManagedBarberApiV1ShopsShopIdBarbersBarberIdGet(
        {
          path: { shop_id: shopId, barber_id: barber.id },
        },
      );
      return data.data;
    },
    onSuccess: (saved) => {
      toast.success(
        barber ? "Barber updated" : `${saved.display_name} added to the team`,
      );
      void queryClient.invalidateQueries({ queryKey: ["barbers", shopId] });
      void queryClient.invalidateQueries({
        queryKey: ["managed-barber", shopId],
      });
      onOpenChange(false);
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("A barber needs a name.");
      return;
    }
    setError(null);
    save.mutate();
  };

  const needsLookup = !barber && !matched;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {barber ? `Edit ${barber.name}` : "Add a barber"}
          </DialogTitle>
          <DialogDescription>
            {barber
              ? "Update how this barber appears to customers."
              : needsLookup
                ? "They must already have a Drop account."
                : "Just the basics — services and hours come next."}
          </DialogDescription>
        </DialogHeader>

        {needsLookup ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="barber-email">Barber's email</Label>
              <Input
                id="barber-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="mt-2"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => lookup.mutate()}
                disabled={lookup.isPending || !email.trim()}
              >
                {lookup.isPending ? "Looking up…" : "Look up"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {!barber && matched && (
              <div className="rounded-md border border-hairline bg-surface-soft p-3 text-sm">
                Adding <span className="font-medium">{matched.email}</span> as:{" "}
                <button
                  type="button"
                  onClick={() => setMatched(null)}
                  className="text-muted-foreground underline underline-offset-2"
                >
                  change email
                </button>
              </div>
            )}

            <div>
              <Label htmlFor="barber-name">Name</Label>
              <Input
                id="barber-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Raj Menon"
                className="mt-2"
                aria-invalid={!!error}
                aria-describedby={error ? "barber-name-error" : undefined}
              />
              {error && (
                <p
                  id="barber-name-error"
                  role="alert"
                  className="mt-1.5 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="barber-bio">Short bio</Label>
              <Textarea
                id="barber-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="What they're known for — skin fades, scissor work, beard shaping…"
                className="mt-1.5 min-h-20"
              />
            </div>

            <div>
              <Label>Profile photo</Label>
              <div className="mt-1.5">
                <ReferencePhotoUploader
                  photos={photos}
                  onChange={setPhotos}
                  max={1}
                  emptyHint="Customers pick a barber faster when they can see a face."
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending
                  ? "Saving…"
                  : barber
                    ? "Save changes"
                    : "Add barber"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
