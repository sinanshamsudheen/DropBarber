import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, ImageIcon, UserX } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/common/status-badge";
import { ErrorState, ListSkeleton } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  closeAppointmentWithoutDetails,
  completeAppointment,
  getAppointment,
  getShopCustomer,
  markNoShow,
} from "@/lib/api";
import { longDate, money, timeLabel } from "@/lib/format";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/manage/$shopId/appointments/$appointmentId")({
  component: ManageAppointmentDetail,
});

function ManageAppointmentDetail() {
  const { shopId, appointmentId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();

  const q = useQuery({
    queryKey: ["appointment", appointmentId],
    queryFn: () => getAppointment(appointmentId),
  });
  const historyQuery = useQuery({
    queryKey: ["shop-customer", shopId, q.data?.customerId],
    queryFn: () => getShopCustomer(shopId, q.data!.customerId),
    enabled: !!q.data,
  });

  const [actualService, setActualService] = useState("");
  const [finalPrice, setFinalPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [finishedPhoto, setFinishedPhoto] = useState("");

  useEffect(() => {
    if (q.data) {
      setActualService((v) => v || q.data.service.name);
      setFinalPrice((v) => v || String(q.data.price));
    }
  }, [q.data]);

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ["appointment", appointmentId],
    });
    void queryClient.invalidateQueries({ queryKey: ["shop-day", shopId] });
    void queryClient.invalidateQueries({
      queryKey: ["shop-appointments", shopId],
    });
    void queryClient.invalidateQueries({ queryKey: ["barber-points", shopId] });
  };

  const complete = useMutation({
    mutationFn: () =>
      completeAppointment(appointmentId, {
        actualService,
        finalPrice: Number(finalPrice) || 0,
        ...(notes ? { notes } : {}),
        ...(finishedPhoto ? { finishedPhoto } : {}),
      }),
    onSuccess: () => {
      toast.success("Record completed — 10 points earned");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const quickClose = useMutation({
    mutationFn: () => closeAppointmentWithoutDetails(appointmentId),
    onSuccess: () => {
      toast.success("Marked as done");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const noShow = useMutation({
    mutationFn: () => markNoShow(appointmentId),
    onSuccess: () => {
      toast.success("Marked as a no-show");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isPending) return <ListSkeleton rows={4} />;
  if (q.isError || !q.data)
    return <ErrorState message={(q.error as Error)?.message} onRetry={() => void q.refetch()} />;

  const a = q.data;
  const pastVisits = (historyQuery.data?.appointments ?? []).filter(
    (x) => x.id !== a.id && x.status === "completed",
  );

  return (
    <div className="space-y-6">
      <button
        onClick={() =>
          void navigate({
            to: "/manage/$shopId/appointments",
            params: { shopId },
          })
        }
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Appointments
      </button>

      <header className="rounded-md border border-hairline bg-card p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">{a.customer.name}</h1>
            <p className="text-sm text-muted-foreground">
              {longDate(a.date)} · {timeLabel(a.time)} · {a.durationMin} min
            </p>
          </div>
          <StatusBadge status={a.status} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Field label="Service" value={a.service.name} />
          <Field label="Barber" value={a.barber.name} />
          <Field label="Booked price" value={money(a.price)} />
          <Field label="Phone" value={a.customer.phone} />
        </dl>
        {a.note && <p className="mt-3 rounded-sm bg-surface-strong p-3 text-sm">“{a.note}”</p>}
        <div className="mt-3">
          <Link
            to="/manage/$shopId/customers/$customerId"
            params={{ shopId, customerId: a.customerId }}
            className="text-sm font-medium text-ink underline-offset-4 hover:underline"
          >
            View customer profile
          </Link>
        </div>
      </header>

      {a.referencePhotos.length > 0 && (
        <section>
          <h2 className="type-display-sm text-ink">Reference photos</h2>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {a.referencePhotos.map((p) => (
              <figure key={p.id} className="overflow-hidden rounded-sm border border-hairline">
                <img
                  src={p.url}
                  alt={p.caption ? p.caption : "Reference photo"}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
              </figure>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="type-display-sm text-ink">Previous visits at this shop</h2>
        {pastVisits.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">First time with you — make it count.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {pastVisits.slice(0, 4).map((v) => (
              <li key={v.id} className="rounded-sm border border-hairline bg-card p-3 text-sm">
                <p className="font-medium">
                  {longDate(v.date)} · {v.completion?.actualService ?? v.service.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {v.barber.name} · {money(v.completion?.finalPrice ?? v.price)}
                </p>
                {v.completion?.notes && <p className="mt-1 text-sm">“{v.completion.notes}”</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {a.status === "completed" ? (
        <section className="rounded-md border border-success/30 bg-success/8 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="size-4 text-success" aria-hidden /> Service record
          </h2>
          {a.completion ? (
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <Field
                label="Service performed"
                value={a.completion.actualService ?? a.service.name}
              />
              <Field label="Final price" value={money(a.completion.finalPrice)} />
              {a.completion.notes && <Field label="Notes" value={a.completion.notes} />}
              <Field label="Points awarded" value={`${a.completion.pointsAwarded}`} />
            </dl>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Closed without a detailed record.</p>
          )}
          {a.completion?.finishedPhoto && (
            <img
              src={a.completion.finishedPhoto}
              alt="Finished haircut"
              loading="lazy"
              className="mt-3 aspect-square w-32 rounded-sm object-cover"
            />
          )}
        </section>
      ) : a.status === "booked" ? (
        <section className="rounded-md border border-hairline bg-card p-4">
          <h2 className="text-base font-semibold">Complete the record</h2>
          <p className="text-sm text-muted-foreground">
            Logged by {user?.name ?? "you"}. Completing a record earns 10 points.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="svc">Service actually performed</Label>
              <Input
                id="svc"
                value={actualService}
                onChange={(e) => setActualService(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="price">Final price (₹)</Label>
              <Input
                id="price"
                inputMode="numeric"
                value={finalPrice}
                onChange={(e) => setFinalPrice(e.target.value.replace(/[^\d]/g, ""))}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="notes">Private notes for next time</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Clipper guards, parting, products used…"
                className="mt-1.5 min-h-20"
              />
            </div>
            <div>
              <Label htmlFor="photo">Finished haircut photo URL (private)</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <ImageIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <Input
                  id="photo"
                  value={finishedPhoto}
                  onChange={(e) => setFinishedPhoto(e.target.value)}
                  placeholder="Optional — never shown publicly"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Button
              size="lg"
              className="w-full"
              disabled={complete.isPending || !actualService}
              onClick={() => complete.mutate()}
            >
              {complete.isPending ? "Saving…" : "Complete record"}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                disabled={quickClose.isPending}
                onClick={() => quickClose.mutate()}
              >
                Done, skip details
              </Button>
              <Button variant="outline" disabled={noShow.isPending} onClick={() => noShow.mutate()}>
                <UserX className="size-4" aria-hidden /> No-show
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-md border border-hairline bg-card p-4 text-sm text-muted-foreground">
          This appointment was {a.status === "no_show" ? "marked as a no-show" : "cancelled"}.
        </section>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}
