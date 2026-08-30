import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CalendarClock, MapPin, Star, Store } from "lucide-react";
import { toast } from "sonner";
import { ReviewDialog } from "@/components/booking/review-dialog";
import { StatusBadge } from "@/components/common/status-badge";
import { ErrorState, ListSkeleton } from "@/components/common/states";
import { CustomerShell } from "@/components/layout/customer-shell";
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
import { useAppointmentDetail } from "@/hooks/use-appointment-detail";
import { cancelAppointmentApiV1AppointmentsAppointmentIdCancelPost } from "@/lib/api/generated/clients/cancelAppointmentApiV1AppointmentsAppointmentIdCancelPost";
import { getErrorMessage } from "@/lib/api-client";
import { duration, longDate, money, timeLabel } from "@/lib/format";

export const Route = createFileRoute("/bookings/$appointmentId")({
  head: () => ({
    meta: [
      { title: "Appointment details — Drop" },
      {
        name: "description",
        content:
          "Your appointment details, reference photos and completion record.",
      },
      { property: "og:title", content: "Appointment details — Drop" },
      {
        property: "og:description",
        content: "Appointment details, reference photos and status.",
      },
    ],
  }),
  component: AppointmentDetail,
});

function AppointmentDetail() {
  const { appointmentId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const q = useAppointmentDetail(appointmentId);

  const cancel = useMutation({
    mutationFn: () =>
      cancelAppointmentApiV1AppointmentsAppointmentIdCancelPost({
        path: { appointment_id: appointmentId },
      }),
    onSuccess: () => {
      toast.success("Appointment cancelled");
      void queryClient.invalidateQueries();
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  });

  if (q.isPending) {
    return (
      <CustomerShell>
        <div className="page-narrow pt-8 sm:pt-10">
          <ListSkeleton rows={3} />
        </div>
      </CustomerShell>
    );
  }
  if (q.isError) {
    return (
      <CustomerShell>
        <div className="page-narrow pt-8 sm:pt-10">
          <ErrorState
            message={getErrorMessage(q.error)}
            onRetry={() => void q.refetch()}
          />
        </div>
      </CustomerShell>
    );
  }

  const a = q.data;
  const canCancel = a.status === "booked";
  const canReview = a.status === "completed" && !a.review;

  return (
    <CustomerShell>
      <div className="page-narrow pb-12 pt-6 sm:pb-16">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-4 rounded-full"
          onClick={() => void navigate({ to: "/bookings" })}
        >
          <ArrowLeft className="size-4" aria-hidden /> Bookings
        </Button>

        <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
          <div className="min-w-0">
            <h1 className="type-display-lg truncate text-ink">
              {a.service?.name ?? "Service"}
            </h1>
            <p className="mt-1 text-base text-muted-foreground">
              {a.shop.name} · {a.barber.name}
            </p>
          </div>
          <StatusBadge status={a.status} />
        </div>

        <div className="mt-6 space-y-3 rounded-md border border-hairline bg-card p-4 sm:p-5 md:p-6">
          <Row
            icon={CalendarClock}
            label="When"
            value={`${longDate(a.date)} · ${timeLabel(a.time)}`}
          />
          <Row icon={Star} label="Duration" value={duration(a.durationMin)} />
          <Row icon={MapPin} label="Where" value={a.shop.address} />
          <Row
            icon={Store}
            label="Price"
            value={money(a.completion?.finalPrice ?? a.price)}
          />
        </div>

        {a.note && (
          <section className="mt-6 sm:mt-10">
            <h2 className="type-display-md text-ink">Your note</h2>
            <p className="mt-4 rounded-md border border-hairline bg-card p-4 text-base text-body sm:p-5 md:p-6">
              {a.note}
            </p>
          </section>
        )}

        {a.referencePhotos.length > 0 && (
          <section className="mt-6 sm:mt-10">
            <h2 className="type-display-md text-ink">Reference photos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Shared with {a.barber.name} for this appointment.
            </p>
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
              {a.referencePhotos.map((p) => (
                <img
                  key={p.id}
                  src={p.url}
                  alt={p.caption ?? "Reference photo"}
                  loading="lazy"
                  className="h-40 w-28 shrink-0 rounded-md border border-hairline object-cover"
                />
              ))}
            </div>
          </section>
        )}

        {a.completion && (
          <section className="mt-6 rounded-md border border-hairline bg-surface-soft p-4 sm:mt-10 sm:p-5 md:p-6">
            <h2 className="type-display-md text-ink">What was done</h2>
            <dl className="mt-4 space-y-2 text-base">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Service performed</dt>
                <dd className="text-right font-medium text-ink">
                  {a.completion.actualService}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Final price</dt>
                <dd className="text-right font-semibold text-ink">
                  {money(a.completion.finalPrice)}
                </dd>
              </div>
            </dl>
            {a.completion.finishedPhoto && (
              <div className="mt-5">
                <p className="text-sm text-muted-foreground">
                  Finished cut (shared with you only)
                </p>
                <img
                  src={a.completion.finishedPhoto}
                  alt="Finished haircut"
                  loading="lazy"
                  className="mt-2 h-44 w-32 rounded-md border border-hairline object-cover"
                />
              </div>
            )}
          </section>
        )}

        <div className="mt-6 flex flex-col gap-3 border-t border-hairline pt-6 sm:mt-10 sm:flex-row sm:flex-wrap sm:pt-8">
          {canReview && (
            <ReviewDialog
              appointmentId={a.id}
              shopName={a.shop.name}
              barberName={a.barber.name}
              trigger={
                <Button className="w-full sm:w-auto">Leave a review</Button>
              }
            />
          )}
          {a.review && (
            <p className="w-full rounded-md border border-hairline bg-card px-5 py-4 text-base text-muted-foreground">
              You reviewed this visit: “{a.review.text}”
            </p>
          )}
          <Button asChild variant="secondary" className="w-full sm:w-auto">
            <Link to="/shops/$shopId" params={{ shopId: a.shopId }}>
              View shop
            </Link>
          </Button>
          {a.status !== "booked" && (
            <Button asChild variant="secondary" className="w-full sm:w-auto">
              <Link
                to="/shops/$shopId/book"
                params={{ shopId: a.shopId }}
                search={{
                  step: 1,
                  serviceId: a.serviceId,
                  barberId: a.barberId,
                }}
              >
                Book again
              </Link>
            </Button>
          )}
          {canCancel && (
            <>
              <Button asChild variant="secondary" className="w-full sm:w-auto">
                <Link
                  to="/shops/$shopId/book"
                  params={{ shopId: a.shopId }}
                  search={{
                    step: 3,
                    serviceId: a.serviceId,
                    barberId: a.barberId,
                  }}
                >
                  Reschedule
                </Link>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full text-destructive hover:text-destructive sm:w-auto"
                  >
                    Cancel appointment
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Cancel this appointment?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Your slot at {a.shop.name} on {longDate(a.date)} at{" "}
                      {timeLabel(a.time)} will be released.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep it</AlertDialogCancel>
                    <AlertDialogAction onClick={() => cancel.mutate()}>
                      Cancel appointment
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>
    </CustomerShell>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 text-base">
      <Icon className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden />
      <span className="text-muted-foreground">{label}</span>
      <span className="ms-auto text-right font-medium text-ink">{value}</span>
    </div>
  );
}
