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
import { saveBarber } from "@/lib/api";
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

  useEffect(() => {
    if (!open) return;
    setName(barber?.name ?? "");
    setBio(barber?.bio ?? "");
    setPhotos(barber?.photo ? [{ id: "current", url: barber.photo }] : []);
    setError(null);
  }, [open, barber]);

  const save = useMutation({
    mutationFn: () =>
      saveBarber(shopId, {
        ...(barber ? { id: barber.id } : {}),
        name: name.trim(),
        bio: bio.trim(),
        photo: photos[0]?.url,
      }),
    onSuccess: (saved) => {
      toast.success(barber ? "Barber updated" : `${saved.name} added to the team`);
      void queryClient.invalidateQueries({ queryKey: ["barbers", shopId] });
      void queryClient.invalidateQueries({ queryKey: ["managed-barber", shopId] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{barber ? `Edit ${barber.name}` : "Add a barber"}</DialogTitle>
          <DialogDescription>
            {barber
              ? "Update how this barber appears to customers."
              : "Just the basics — services and hours come next."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="barber-name">Name</Label>
            <Input
              id="barber-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Raj Menon"
              className="mt-1.5 h-11"
              aria-invalid={!!error}
              aria-describedby={error ? "barber-name-error" : undefined}
            />
            {error && (
              <p id="barber-name-error" role="alert" className="mt-1.5 text-xs text-destructive">
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : barber ? "Save changes" : "Add barber"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
