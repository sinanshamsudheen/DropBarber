import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CalendarCheck, CalendarX, CheckCircle2, ImageIcon, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BarberCard } from "@/components/cards/barber-card";
import { ServiceCard } from "@/components/cards/service-card";
import { DateStrip } from "@/components/booking/date-strip";
import { TimeSlotPicker } from "@/components/booking/time-slot-picker";
import { ReferencePhotoUploader } from "@/components/common/photo-uploader";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { CustomerShell } from "@/components/layout/customer-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { createAppointment, getAvailability, getShop } from "@/lib/api";
import { dayLabel, duration, longDate, money, timeLabel, todayISO } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Photo } from "@/lib/types";

interface BookSearch {
  step: number;
  serviceId?: string | undefined;
  barberId?: string | undefined;
  date?: string | undefined;
  time?: string | undefined;
}

export const Route = createFileRoute("/shops/$shopId/book")({
  validateSearch: (search: Record<string, unknown>): BookSearch => {
    const out: BookSearch = { step: Number(search["step"]) || 1 };
    if (typeof search["serviceId"] === "string") out.serviceId = search["serviceId"];
    if (typeof search["barberId"] === "string") out.barberId = search["barberId"];
    if (typeof search["date"] === "string") out.date = search["date"];
    if (typeof search["time"] === "string") out.time = search["time"];
    return out;
  },
  head: () => ({
    meta: [
      { title: "Book an appointment — Drop" },
      { name: "description", content: "Pick a service, barber, date and an available time slot." },
      { property: "og:title", content: "Book an appointment — Drop" },
      { property: "og:description", content: "Pick a service, barber, date and time in a few taps." },
    ],
  }),
  component: BookingFlow,
});

const STEPS = ["Service", "Barber", "Date", "Time", "Details"];

function BookingFlow() {
  const { shopId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();

  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);

  const shopQuery = useQuery({ queryKey: ["shop", shopId], queryFn: () => getShop(shopId) });

  const step = confirmedId ? 6 : Math.min(Math.max(search.step, 1), 5);
  const setSearch = (patch: Partial<BookSearch>) =>
    void navigate({ to: "/shops/$shopId/book", params: { shopId }, search: { ...search, ...patch } });

  const service = shopQuery.data?.services.find((s) => s.id === search.serviceId);
  const barber = shopQuery.data?.barbers.find((b) => b.id === search.barberId);
  const barberService = barber?.services.find((s) => s.serviceId === search.serviceId);
  const date = search.date ?? todayISO();

  const availability = useQuery({
    queryKey: ["availability", shopId, search.barberId, search.serviceId, date],
    enabled: step >= 4 && !!search.barberId && !!search.serviceId,
    queryFn: () =>
      getAvailability({ shopId, barberId: search.barberId!, serviceId: search.serviceId!, date }),
  });

  const booking = useMutation({
    mutationFn: () =>
      createAppointment({
        shopId,
        barberId: search.barberId!,
        serviceId: search.serviceId!,
        date,
        time: search.time!,
        note: note.trim() || undefined,
        referencePhotos: photos,
      }),
    onSuccess: (appointment) => {
      void queryClient.invalidateQueries({ queryKey: ["customer-appointments"] });
      setConfirmedId(appointment.id);
    },
    onError: (error: Error) => {
      if (error.message === "SLOT_TAKEN") {
        setSearch({ time: undefined });
        void availability.refetch();
        toast.error("That time was just taken", {
          description: "Availability changed while you were booking. Please pick another time.",
        });
      } else {
        toast.error(error.message);
      }
    },
  });

  if (shopQuery.isPending) {
    return (
      <CustomerShell hideNav>
        <div className="page pt-6">
          <ListSkeleton rows={4} />
        </div>
      </CustomerShell>
    );
  }
  if (shopQuery.isError) {
    return (
      <CustomerShell hideNav>
        <div className="page pt-6">
          <ErrorState message={(shopQuery.error as Error).message} onRetry={() => void shopQuery.refetch()} />
        </div>
      </CustomerShell>
    );
  }

  const { shop, services, barbers } = shopQuery.data;
  const activeServices = services.filter((s) => s.active);
  const eligibleBarbers = barbers.filter(
    (b) => b.active && b.services.some((s) => s.serviceId === search.serviceId && s.active),
  );

  /* ------------------------------------------------------------ confirmation */
  if (step === 6 && confirmedId) {
    return (
      <CustomerShell hideNav>
        <div className="page py-10 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-success/12 text-success">
            <CheckCircle2 className="size-8" aria-hidden />
          </span>
          <h1 className="mt-4 text-2xl font-semibold">Appointment booked</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            We've sent the details to your bookings. The shop can see it right away.
          </p>

          <div className="mt-6 space-y-2.5 rounded-2xl border border-border bg-card p-4 text-left">
            <SummaryRow label="Shop" value={shop.name} />
            <SummaryRow label="Barber" value={barber?.name ?? ""} />
            <SummaryRow label="Service" value={service?.name ?? ""} />
            <SummaryRow label="When" value={`${longDate(date)} · ${timeLabel(search.time!)}`} />
            <SummaryRow label="Duration" value={duration(barberService?.durationMin ?? 0)} />
            <SummaryRow label="Location" value={shop.address} />
            <SummaryRow
              label="Reference photos"
              value={photos.length ? `${photos.length} attached` : "None attached"}
            />
            <SummaryRow
              label="Price"
              value={money(barberService?.priceOverride ?? service?.price ?? 0)}
              strong
            />
          </div>

          <div className="mt-6 space-y-2">
            <Button asChild size="lg" className="h-12 w-full rounded-xl">
              <Link to="/bookings/$appointmentId" params={{ appointmentId: confirmedId }}>
                View booking
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 w-full rounded-xl">
              <Link to="/">Back to discover</Link>
            </Button>
          </div>
        </div>
      </CustomerShell>
    );
  }

  const canContinue =
    (step === 1 && !!search.serviceId) ||
    (step === 2 && !!search.barberId) ||
    (step === 3 && !!search.date) ||
    (step === 4 && !!search.time) ||
    step === 5;

  return (
    <CustomerShell hideNav className="pb-32">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="page py-3">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Back"
              onClick={() =>
                step === 1
                  ? void navigate({ to: "/shops/$shopId", params: { shopId } })
                  : setSearch({ step: step - 1 })
              }
            >
              <ArrowLeft className="size-4" aria-hidden />
            </Button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{shop.name}</p>
              <p className="text-xs text-muted-foreground">
                Step {step} of 5 · {STEPS[step - 1]}
              </p>
            </div>
          </div>
          <Progress value={(step / 5) * 100} className="mt-2 h-1" />
        </div>
      </header>

      <div className="page pt-5">
        {step === 1 && (
          <section aria-labelledby="s1">
            <h1 id="s1" className="text-xl font-semibold">
              What are you booking?
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Timings vary by barber — you'll see the exact duration next.
            </p>
            <div className="mt-4 space-y-3">
              {activeServices.map((s) => (
                <ServiceCard
                  key={s.id}
                  service={s}
                  selected={search.serviceId === s.id}
                  onSelect={() => setSearch({ serviceId: s.id, barberId: undefined, time: undefined })}
                />
              ))}
            </div>
          </section>
        )}

        {step === 2 && (
          <section aria-labelledby="s2">
            <h1 id="s2" className="text-xl font-semibold">
              Choose your barber
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Each barber takes a different amount of time for {service?.name.toLowerCase()}.
            </p>
            <div className="mt-4 space-y-3">
              {eligibleBarbers.length === 0 && (
                <EmptyState
                  title="No barber offers this service right now"
                  description="Pick a different service to continue."
                  action={
                    <Button variant="outline" onClick={() => setSearch({ step: 1 })}>
                      Back to services
                    </Button>
                  }
                />
              )}
              {eligibleBarbers.map((b) => {
                const bs = b.services.find((s) => s.serviceId === search.serviceId)!;
                return (
                  <BarberCard
                    key={b.id}
                    barber={b}
                    durationMin={bs.durationMin}
                    price={bs.priceOverride ?? service?.price ?? null}
                    selected={search.barberId === b.id}
                    onSelect={() => setSearch({ barberId: b.id, time: undefined })}
                  />
                );
              })}
            </div>
          </section>
        )}

        {step === 3 && (
          <section aria-labelledby="s3">
            <h1 id="s3" className="text-xl font-semibold">
              Pick a date
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {barber?.name} · {service?.name} · {duration(barberService?.durationMin ?? 0)}
            </p>
            <div className="mt-4">
              <DateStrip value={search.date ?? ""} onChange={(d) => setSearch({ date: d, time: undefined })} />
            </div>
            {search.date && (
              <p className="mt-4 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium">
                {longDate(search.date)}
              </p>
            )}
          </section>
        )}

        {step === 4 && (
          <section aria-labelledby="s4">
            <h1 id="s4" className="text-xl font-semibold">
              Available times
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {dayLabel(date)} · {barber?.name} · {duration(barberService?.durationMin ?? 0)}
            </p>
            <div className="mt-3">
              <DateStrip value={date} onChange={(d) => setSearch({ date: d, time: undefined })} />
            </div>
            <div className="mt-5">
              {availability.isError ? (
                <ErrorState
                  title="Couldn't load availability"
                  message={(availability.error as Error).message}
                  onRetry={() => void availability.refetch()}
                />
              ) : availability.isPending ? (
                <TimeSlotPicker slots={[]} loading onChange={() => {}} />
              ) : availability.data.slots.length === 0 ? (
                <EmptyState
                  icon={CalendarX}
                  title="No available times for this barber and service on this date"
                  description="Try another date, or go back and pick a different barber."
                  action={
                    <Button variant="outline" onClick={() => setSearch({ step: 2 })}>
                      Change barber
                    </Button>
                  }
                />
              ) : (
                <TimeSlotPicker
                  slots={availability.data.slots}
                  value={search.time}
                  onChange={(t) => setSearch({ time: t })}
                />
              )}
            </div>
          </section>
        )}

        {step === 5 && (
          <section aria-labelledby="s5">
            <h1 id="s5" className="text-xl font-semibold">
              Confirm your booking
            </h1>

            <div className="mt-4 space-y-2.5 rounded-2xl border border-border bg-card p-4">
              <SummaryRow label="Shop" value={shop.name} />
              <SummaryRow label="Barber" value={barber?.name ?? ""} />
              <SummaryRow label="Service" value={service?.name ?? ""} />
              <SummaryRow label="Date" value={longDate(date)} />
              <SummaryRow label="Time" value={search.time ? timeLabel(search.time) : "—"} />
              <SummaryRow label="Duration" value={duration(barberService?.durationMin ?? 0)} />
              <SummaryRow
                label="Price"
                value={money(barberService?.priceOverride ?? service?.price ?? 0)}
                strong
              />
            </div>

            <div className="mt-5">
              <Label htmlFor="note">Add a note (optional)</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything your barber should know?"
                className="mt-1.5 min-h-20"
              />
            </div>

            <div className="mt-5">
              <div className="flex items-center gap-2">
                <ImageIcon className="size-4 text-accent" aria-hidden />
                <p className="text-sm font-semibold">Reference photo for this appointment</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Shared with this barber for this visit only. Saved style photos on your profile stay with you
                across shops — these don't.
              </p>
              <div className="mt-3">
                <ReferencePhotoUploader
                  photos={photos}
                  onChange={setPhotos}
                  emptyHint="Optional, but barbers love a picture to work from."
                />
              </div>
            </div>

            {!user && (
              <div className="mt-5 rounded-2xl border border-accent/30 bg-accent/8 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Lock className="size-4" aria-hidden /> Log in to finish
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your service, barber, date and time are saved — you'll come straight back here.
                </p>
                <Button asChild className="mt-3 h-11 w-full rounded-xl">
                  <Link
                    to="/auth"
                    search={{ redirect: typeof window !== "undefined" ? window.location.href : "/" }}
                  >
                    Log in or sign up
                  </Link>
                </Button>
              </div>
            )}
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          {step === 5 ? (
            <Button
              size="lg"
              className="h-12 w-full rounded-xl"
              disabled={!user || !search.time || booking.isPending}
              onClick={() => booking.mutate()}
            >
              <CalendarCheck className="size-4" aria-hidden />
              {booking.isPending ? "Booking…" : "Confirm booking"}
            </Button>
          ) : (
            <Button
              size="lg"
              className="h-12 w-full rounded-xl"
              disabled={!canContinue}
              onClick={() => setSearch({ step: step + 1, ...(step === 2 && !search.date ? { date } : {}) })}
            >
              Continue
            </Button>
          )}
        </div>
      </div>
    </CustomerShell>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "text-right font-semibold" : "text-right font-medium"}>{value}</span>
    </div>
  );
}
