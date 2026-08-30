import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarCheck,
  CalendarX,
  CheckCircle2,
  ImageIcon,
  Lock,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { BarberCard } from "@/components/cards/barber-card";
import { ServiceCard } from "@/components/cards/service-card";
import { DateStrip } from "@/components/booking/date-strip";
import { TimeSlotPicker } from "@/components/booking/time-slot-picker";
import { ReferencePhotoUploader } from "@/components/common/photo-uploader";
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
} from "@/components/common/states";
import { CustomerShell } from "@/components/layout/customer-shell";
import { Wordmark } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useShopProfile } from "@/hooks/use-shop-profile";
import { getAvailabilityApiV1ShopsShopIdBarbersBarberIdAvailabilityGetQueryOptions } from "@/lib/api/generated/hooks/useGetAvailabilityApiV1ShopsShopIdBarbersBarberIdAvailabilityGet";
import { createAppointmentApiV1AppointmentsPost } from "@/lib/api/generated/clients/createAppointmentApiV1AppointmentsPost";
import { getErrorCode, getErrorMessage } from "@/lib/api-client";
import {
  dayLabel,
  duration,
  longDate,
  money,
  timeLabel,
  todayISO,
} from "@/lib/format";
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
    if (typeof search["serviceId"] === "string")
      out.serviceId = search["serviceId"];
    if (typeof search["barberId"] === "string")
      out.barberId = search["barberId"];
    if (typeof search["date"] === "string") out.date = search["date"];
    if (typeof search["time"] === "string") out.time = search["time"];
    return out;
  },
  head: () => ({
    meta: [
      { title: "Book an appointment — Drop" },
      {
        name: "description",
        content: "Pick a service, barber, date and an available time slot.",
      },
      { property: "og:title", content: "Book an appointment — Drop" },
      {
        property: "og:description",
        content: "Pick a service, barber, date and time in a few taps.",
      },
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

  const shopQuery = useShopProfile(shopId);

  const step = confirmedId ? 6 : Math.min(Math.max(search.step, 1), 5);
  const setSearch = (patch: Partial<BookSearch>) =>
    void navigate({
      to: "/shops/$shopId/book",
      params: { shopId },
      search: { ...search, ...patch },
    });

  const service = shopQuery.data?.services.find(
    (s) => s.id === search.serviceId,
  );
  const barber = shopQuery.data?.barbers.find((b) => b.id === search.barberId);
  const barberService = barber?.services.find(
    (s) => s.serviceId === search.serviceId,
  );
  const date = search.date ?? todayISO();
  const price = barberService?.priceOverride ?? service?.price ?? 0;

  const availability = useQuery({
    ...getAvailabilityApiV1ShopsShopIdBarbersBarberIdAvailabilityGetQueryOptions(
      {
        path: { shop_id: shopId, barber_id: search.barberId ?? "" },
        query: { service_id: search.serviceId ?? "", date },
      },
    ),
    enabled: step >= 4 && !!search.barberId && !!search.serviceId,
  });
  const slots = (availability.data?.data.slots ?? []).map((s) => ({
    time: s.time.slice(0, 5),
    durationMin: s.duration_minutes,
  }));

  const booking = useMutation({
    mutationFn: async () => {
      const { data } = await createAppointmentApiV1AppointmentsPost({
        body: {
          shop_id: shopId,
          barber_id: search.barberId!,
          service_id: search.serviceId!,
          start_at: new Date(`${date}T${search.time}:00`).toISOString(),
          booking_note: note.trim() || null,
          reference_media_ids: photos.map((p) => p.id),
        },
      });
      return data.data;
    },
    onSuccess: (appointment) => {
      void queryClient.invalidateQueries({
        queryKey: ["appointments", "mine"],
      });
      setConfirmedId(appointment.id);
    },
    onError: (error: unknown) => {
      if (getErrorCode(error) === "APPOINTMENT_SLOT_UNAVAILABLE") {
        setSearch({ time: undefined });
        void availability.refetch();
        toast.error("That time was just taken", {
          description:
            "Availability changed while you were booking. Please pick another time.",
        });
      } else {
        toast.error(getErrorMessage(error));
      }
    },
  });

  if (shopQuery.isPending) {
    return (
      <CustomerShell hideNav hideHeader hideFooter>
        <div className="page-narrow pt-8 sm:pt-10">
          <ListSkeleton rows={4} />
        </div>
      </CustomerShell>
    );
  }
  if (shopQuery.isError || !shopQuery.data) {
    return (
      <CustomerShell hideNav hideHeader hideFooter>
        <div className="page-narrow pt-8 sm:pt-10">
          <ErrorState
            message={getErrorMessage(shopQuery.error)}
            onRetry={() => void shopQuery.refetch()}
          />
        </div>
      </CustomerShell>
    );
  }

  const { shop, services, barbers } = shopQuery.data;
  const activeServices = services.filter((s) => s.active);
  const eligibleBarbers = barbers.filter(
    (b) =>
      b.active &&
      b.services.some((s) => s.serviceId === search.serviceId && s.active),
  );

  /* ------------------------------------------------------------ confirmation */
  if (step === 6 && confirmedId) {
    return (
      <CustomerShell hideNav hideHeader hideFooter>
        <div className="page-form py-10 sm:py-16">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-surface-strong text-ink">
            <CheckCircle2 className="size-8" aria-hidden />
          </span>
          <h1 className="type-display-xl mt-6 text-center text-ink">
            Appointment booked
          </h1>
          <p className="mt-2 text-center text-base text-muted-foreground">
            We've sent the details to your bookings. The shop can see it right
            away.
          </p>

          <div className="mt-8 space-y-3 rounded-md border border-hairline bg-card p-4 shadow-float sm:p-5 md:p-6">
            <SummaryRow label="Shop" value={shop.name} />
            <SummaryRow label="Barber" value={barber?.name ?? ""} />
            <SummaryRow label="Service" value={service?.name ?? ""} />
            <SummaryRow
              label="When"
              value={`${longDate(date)} · ${timeLabel(search.time!)}`}
            />
            <SummaryRow
              label="Duration"
              value={duration(barberService?.durationMin ?? 0)}
            />
            <SummaryRow label="Location" value={shop.address} />
            <SummaryRow
              label="Reference photos"
              value={
                photos.length ? `${photos.length} attached` : "None attached"
              }
            />
            <div className="border-t border-hairline pt-3">
              <SummaryRow label="Pay at the shop" value={money(price)} strong />
            </div>
          </div>

          <div className="mt-8 space-y-3">
            <Button asChild className="w-full">
              <Link
                to="/bookings/$appointmentId"
                params={{ appointmentId: confirmedId }}
              >
                View booking
              </Link>
            </Button>
            <Button asChild variant="secondary" className="w-full">
              <Link to="/">Back to all shops</Link>
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

  const cta =
    step === 5 ? (
      <Button
        className="w-full"
        disabled={!user || !search.time || booking.isPending}
        onClick={() => booking.mutate()}
      >
        <CalendarCheck className="size-4" aria-hidden />
        {booking.isPending ? "Booking…" : "Confirm booking"}
      </Button>
    ) : (
      <Button
        className="w-full"
        disabled={!canContinue}
        onClick={() =>
          setSearch({
            step: step + 1,
            ...(step === 2 && !search.date ? { date } : {}),
          })
        }
      >
        Continue
      </Button>
    );

  return (
    <CustomerShell hideNav hideHeader hideFooter className="pb-32 lg:pb-0">
      <header className="sticky top-0 z-40 border-b border-hairline bg-background">
        <div className="page-narrow flex h-20 items-center gap-4">
          <Button
            variant="secondary"
            size="icon-sm"
            className="rounded-full"
            aria-label="Back"
            onClick={() =>
              step === 1
                ? void navigate({ to: "/shops/$shopId", params: { shopId } })
                : setSearch({ step: step - 1 })
            }
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="type-title-md truncate text-ink">{shop.name}</p>
            <p className="text-sm text-muted-foreground">
              Step {step} of 5 · {STEPS[step - 1]}
            </p>
          </div>
          <Wordmark className="hidden sm:inline-flex" />
        </div>
        <Progress value={(step / 5) * 100} className="h-0.5 rounded-none" />
      </header>

      <div className="page-narrow grid gap-x-8 gap-y-6 pb-16 pt-6 sm:gap-y-8 sm:pt-8 lg:grid-cols-[minmax(0,1fr)_372px] lg:gap-x-16 lg:gap-y-10 lg:pt-10">
        <div className="min-w-0">
          {step === 1 && (
            <Step
              title="What are you booking?"
              hint="Timings vary by barber — you'll see the exact duration next."
            >
              <div className="space-y-3">
                {activeServices.map((s) => (
                  <ServiceCard
                    key={s.id}
                    service={s}
                    selected={search.serviceId === s.id}
                    onSelect={() =>
                      setSearch({
                        serviceId: s.id,
                        barberId: undefined,
                        time: undefined,
                      })
                    }
                  />
                ))}
              </div>
            </Step>
          )}

          {step === 2 && (
            <Step
              title="Choose your barber"
              hint={`Each barber takes a different amount of time for ${service?.name.toLowerCase() ?? "this service"}.`}
            >
              <div className="space-y-3">
                {eligibleBarbers.length === 0 && (
                  <EmptyState
                    title="No barber offers this service right now"
                    description="Pick a different service to continue."
                    action={
                      <Button
                        variant="outline"
                        onClick={() => setSearch({ step: 1 })}
                      >
                        Back to services
                      </Button>
                    }
                  />
                )}
                {eligibleBarbers.map((b) => {
                  const bs = b.services.find(
                    (s) => s.serviceId === search.serviceId,
                  )!;
                  return (
                    <BarberCard
                      key={b.id}
                      barber={b}
                      durationMin={bs.durationMin}
                      price={bs.priceOverride ?? service?.price ?? null}
                      selected={search.barberId === b.id}
                      onSelect={() =>
                        setSearch({ barberId: b.id, time: undefined })
                      }
                    />
                  );
                })}
              </div>
            </Step>
          )}

          {step === 3 && (
            <Step
              title="Pick a date"
              hint={`${barber?.name} · ${service?.name} · ${duration(barberService?.durationMin ?? 0)}`}
            >
              <DateStrip
                value={search.date ?? ""}
                onChange={(d) => setSearch({ date: d, time: undefined })}
              />
              {search.date && (
                <p className="mt-6 rounded-md border border-hairline bg-surface-soft px-5 py-4 text-base font-medium text-ink">
                  {longDate(search.date)}
                </p>
              )}
            </Step>
          )}

          {step === 4 && (
            <Step
              title="Available times"
              hint={`${dayLabel(date)} · ${barber?.name} · ${duration(barberService?.durationMin ?? 0)}`}
            >
              <DateStrip
                value={date}
                onChange={(d) => setSearch({ date: d, time: undefined })}
              />
              <div className="mt-8">
                {availability.isError ? (
                  <ErrorState
                    title="Couldn't load availability"
                    message={getErrorMessage(availability.error)}
                    onRetry={() => void availability.refetch()}
                  />
                ) : availability.isPending ? (
                  <TimeSlotPicker slots={[]} loading onChange={() => {}} />
                ) : slots.length === 0 ? (
                  <EmptyState
                    icon={CalendarX}
                    title="No available times for this barber and service on this date"
                    description="Try another date, or go back and pick a different barber."
                    action={
                      <Button
                        variant="outline"
                        onClick={() => setSearch({ step: 2 })}
                      >
                        Change barber
                      </Button>
                    }
                  />
                ) : (
                  <TimeSlotPicker
                    slots={slots}
                    value={search.time}
                    onChange={(t) => setSearch({ time: t })}
                  />
                )}
              </div>
            </Step>
          )}

          {step === 5 && (
            <Step title="Confirm your booking">
              <div className="space-y-8">
                <div>
                  <Label htmlFor="note">Add a note (optional)</Label>
                  <Textarea
                    id="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Anything your barber should know?"
                    className="mt-2"
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <ImageIcon className="size-4 text-ink" aria-hidden />
                    <p className="type-title-md text-ink">
                      Reference photo for this appointment
                    </p>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Shared with this barber for this visit only. Saved style
                    photos on your profile stay with you across shops — these
                    don't.
                  </p>
                  <div className="mt-4">
                    <ReferencePhotoUploader
                      photos={photos}
                      onChange={setPhotos}
                      emptyHint="Optional, but barbers love a picture to work from."
                    />
                  </div>
                </div>

                {!user && (
                  <div className="rounded-md border border-hairline bg-surface-soft p-6">
                    <p className="type-title-md flex items-center gap-2 text-ink">
                      <Lock className="size-4" aria-hidden /> Log in to finish
                    </p>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      Your service, barber, date and time are saved — you'll
                      come straight back here.
                    </p>
                    <Button asChild className="mt-5 w-full sm:w-auto">
                      <Link
                        to="/auth"
                        search={{
                          redirect:
                            typeof window !== "undefined"
                              ? window.location.href
                              : "/",
                        }}
                      >
                        Log in or sign up
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            </Step>
          )}
        </div>

        {/* The running reservation card — sticky right rail above 1024px. */}
        <aside className="hidden lg:block">
          <div className="sticky top-32 rounded-md border border-hairline bg-card p-6 shadow-float">
            <p className="text-ink">
              <span className="type-display-md">{money(price)}</span>{" "}
              <span className="text-base text-muted-foreground">total</span>
            </p>
            <div className="mt-5 space-y-3 border-t border-hairline pt-5">
              <SummaryRow label="Shop" value={shop.name} />
              <SummaryRow
                label="Service"
                value={service?.name ?? "Not picked yet"}
              />
              <SummaryRow
                label="Barber"
                value={barber?.name ?? "Not picked yet"}
              />
              <SummaryRow
                label="Date"
                value={search.date ? longDate(search.date) : "Not picked yet"}
              />
              <SummaryRow
                label="Time"
                value={search.time ? timeLabel(search.time) : "Not picked yet"}
              />
              <SummaryRow
                label="Duration"
                value={
                  barberService ? duration(barberService.durationMin) : "—"
                }
              />
            </div>
            <div className="mt-6">{cta}</div>
            <p className="mt-3 text-center text-sm text-muted-foreground">
              You won't be charged yet
            </p>
          </div>
        </aside>
      </div>

      {/* Below the rail breakpoint the card collapses to a sticky bottom bar. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-background px-6 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          <div className="hidden min-w-0 flex-1 sm:block">
            <p className="truncate text-base font-semibold text-ink">
              {money(price)}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {service?.name ?? "Pick a service"}
            </p>
          </div>
          <div className="flex-1">{cta}</div>
        </div>
      </div>
    </CustomerShell>
  );
}

function Step({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h1 className="type-display-md text-ink">{title}</h1>
      {hint && <p className="mt-1.5 text-base text-muted-foreground">{hint}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span
        className={
          strong ? "text-right font-semibold text-ink" : "text-right text-ink"
        }
      >
        {value}
      </span>
    </div>
  );
}
