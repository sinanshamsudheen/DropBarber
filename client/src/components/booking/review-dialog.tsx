import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { StarInput } from "@/components/common/rating";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createReviewApiV1AppointmentsAppointmentIdReviewPost } from "@/lib/api/generated/clients/createReviewApiV1AppointmentsAppointmentIdReviewPost";
import { getErrorMessage } from "@/lib/api-client";

export function ReviewDialog({
  appointmentId,
  shopName,
  barberName,
  trigger,
}: {
  appointmentId: string;
  shopName: string;
  barberName: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [shopRating, setShopRating] = useState(0);
  const [barberRating, setBarberRating] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      createReviewApiV1AppointmentsAppointmentIdReviewPost({
        path: { appointment_id: appointmentId },
        body: { rating: shopRating, review_text: text.trim() },
      }),
    onSuccess: () => {
      toast.success("Thanks for the review", {
        description: "It's now visible on the shop's profile.",
      });
      void queryClient.invalidateQueries();
      setOpen(false);
    },
    onError: (e: unknown) => setError(getErrorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="type-display-sm">
            Review your visit
          </DialogTitle>
          <DialogDescription>
            Reviews are tied to a real completed appointment at {shopName}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div>
            <Label className="mb-1 block">How was the shop?</Label>
            <StarInput
              value={shopRating}
              onChange={setShopRating}
              label="Shop rating"
            />
          </div>
          <div>
            <Label className="mb-1 block">
              How was {barberName}? (optional)
            </Label>
            <StarInput
              value={barberRating}
              onChange={setBarberRating}
              label="Barber rating"
            />
          </div>
          <div>
            <Label htmlFor="review-text">Your review</Label>
            <Textarea
              id="review-text"
              className="mt-2"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What stood out?"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            className="w-full"
            disabled={!shopRating || mutation.isPending}
            onClick={() => {
              setError(null);
              if (!shopRating) {
                setError("Please give the shop a star rating.");
                return;
              }
              mutation.mutate();
            }}
          >
            {mutation.isPending ? "Submitting…" : "Submit review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
