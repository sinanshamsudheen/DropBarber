import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { cancelAppointment, getAppointment } from "@/lib/api";
import { duration, longDate, money, timeLabel } from "@/lib/format";

export const Route = createFileRoute("/bookings/$appointmentId")({
  head: () => ({
    meta: [
      { title: "Appointment details — Drop" },
      { name: "description", content: "Your appointment details, reference photos and completion record." },
      { property: "og:title", content: "Appointment details — Drop" },
      { property: "og:description", content: "Appointment details, reference photos and status." },
    ],
  }),
  component: AppointmentDetail,
});

function AppointmentDetail() {
  const { appointmentId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ["appointment", appointmentId], queryFn: () => getAppointment(appointmentId) });

  const cancel = useMutation({
    mutationFn: () => cancelAppointment(appointmentId),
    onSuccess: () => {
      toast.success("Appointment cancelled");
      void queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isPending) {
    return (
      <CustomerShell>
        <div className="page pt-6">
          <ListSkeleton rows={3} />
        </div>
      </CustomerShell>
    );
  }
  if (q.isError) {
    return (
      <CustomerShell>
        <div className="page pt-6">
          <ErrorState message={(q.error as Error).message} onRetry={() => void q.refetch()} />
        </div>
      </CustomerShell>
    );
  }

  const a = q.data;
  const canCancel = a.status === "booked";
  const canReview = a.status === "completed" && !a.review;

  return (
    <CustomerShell>
      <div className="page pt-4">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => void navigate({ to: "/bookings" })}>
          <ArrowLeft className="size-4" aria-hidden /> Bookings
        </Button>

        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">{a.service.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {a.shop.name} · {a.barber.name}
            </p>
          </div>
          <StatusBadge status={a.status} />
        </div>

        <div className="mt-5 space-y-2.5 rounded-2xl border border-border bg-card p-4">
          <Row icon={CalendarClock} label="When" value={`${longDate(a.date)} · ${timeLabel(a.time)}`} />
          <Row icon={Star} label="Duration" value={duration(a.durationMin)} />
          <Row icon={MapPin} label="Where" value={a.shop.address} />
          <Row icon={Store} label="Price" value={money(a.completion?.finalPrice ?? a.price)} />
        </div>

        {a.note && (
          <section className="mt-5">
            <h2 className="text-base font-semibold">Your note</h2>
            <p className="mt-2 rounded-2xl border border-border bg-card p-4 text-sm">{a.note}</p>
          </section>
        )}

        {a.referencePhotos.length > 0 && (
          <section className="mt-5">
            <h2 className="text-base font-semibold">Reference photos</h2>
            <p className="text-xs text-muted-foreground">Shared with {a.barber.name} for this appointment.</p>
            <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
              {a.referencePhotos.map((p) => (
                <img
                  key={p.id}
                  src={p.url}
                  alt={p.caption ?? "Reference photo"}
                  loading="lazy"
                  className="h-40 w-28 shrink-0 rounded-xl border border-border object-cover"
                />
              ))}
            </div>
          </section>
        )}

        {a.completion && (
          <section className="mt-5 rounded-2xl border border-success/30 bg-success/6 p-4">
            <h2 className="text-base font-semibold">What was done</h2>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Service performed</dt>
                <dd className="text-right font-medium">{a.completion.actualService}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Final price</dt>
                <dd className="text-right font-semibold">{money(a.completion.finalPrice)}</dd>
              </div>
            </dl>
            {a.completion.finishedPhoto && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground">Finished cut (shared with you only)</p>
                <img
                  src={a.completion.finishedPhoto}
                  alt="Finished haircut"
                  loading="lazy"
                  className="mt-2 h-44 w-32 rounded-xl border border-border object-cover"
                />
              </div>
            )}
          </section>
        )}

        <div className="mt-6 space-y-2">
          {canReview && (
            <ReviewDialog
              appointmentId={a.id}
              shopName={a.shop.name}
              barberName={a.barber.name}
              trigger={
                <Button size="lg" className="h-12 w-full rounded-xl">
                  Leave a review
                </Button>
              }
            />
          )}
          {a.review && (
            <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
              You reviewed this visit: “{a.review.text}”
            </p>
          )}
          <Button asChild variant="outline" size="lg" className="h-12 w-full rounded-xl">
            <Link to="/shops/$shopId" params={{ shopId: a.shopId }}>
              View shop
            </Link>
          </Button>
          {a.status !== "booked" && (
            <Button asChild variant="outline" size="lg" className="h-12 w-full rounded-xl">
              <Link to="/shops/$shopId/book" params={{ shopId: a.shopId }} search={{ step: 1, serviceId: a.serviceId, barberId: a.barberId }}>
                Book again
              </Link>
            </Button>
          )}
          {canCancel && (
            <>
              <Button asChild variant="outline" size="lg" className="h-12 w-full rounded-xl">
                <Link
                  to="/shops/$shopId/book"
                  params={{ shopId: a.shopId }}
                  search={{ step: 3, serviceId: a.serviceId, barberId: a.barberId }}
                >
                  Reschedule
                </Link>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="lg" className="h-12 w-full rounded-xl text-destructive">
                    Cancel appointment
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Your slot at {a.shop.name} on {longDate(a.date)} at {timeLabel(a.time)} will be released.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep it</AlertDialogCancel>
                    <AlertDialogAction onClick={() => cancel.mutate()}>Cancel appointment</AlertDialogAction>
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
    <div className="flex items-start gap-3 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
      <span className="text-muted-foreground">{label}</span>
      <span className="ms-auto text-right font-medium">{value}</span>
    </div>
  );
}
