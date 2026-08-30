import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ImageOff,
  Mail,
  NotebookPen,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { initials } from "@/components/cards/barber-card";
import { StatusBadge } from "@/components/common/status-badge";
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
} from "@/components/common/states";
import {
  ManageHeader,
  RequirePermission,
} from "@/components/layout/manage-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useShopCustomer } from "@/hooks/use-shop-customer";
import { updateShopCustomerApiV1ShopsShopIdCustomersCustomerIdPatch } from "@/lib/api/generated/clients/updateShopCustomerApiV1ShopsShopIdCustomersCustomerIdPatch";
import { getErrorMessage } from "@/lib/api-client";
import { dayLabel, longDate, money, timeLabel } from "@/lib/format";

export const Route = createFileRoute("/manage/$shopId/customers/$customerId")({
  component: CustomerDetailRoute,
});

function CustomerDetailRoute() {
  const { shopId } = Route.useParams();
  return (
    <RequirePermission shopId={shopId} permission="customers:view">
      <CustomerDetail />
    </RequirePermission>
  );
}

function CustomerDetail() {
  const { shopId, customerId } = Route.useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState("");

  const q = useShopCustomer(shopId, customerId);

  const saveNote = useMutation({
    mutationFn: () =>
      updateShopCustomerApiV1ShopsShopIdCustomersCustomerIdPatch({
        path: { shop_id: shopId, customer_id: customerId },
        body: { notes: note.trim() },
      }),
    onSuccess: () => {
      setNote("");
      toast.success("Note saved to this customer's shop record");
      void q.refetch();
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  });

  if (q.isPending) return <ListSkeleton rows={4} />;
  if (q.isError || !q.data)
    return (
      <ErrorState
        message={getErrorMessage(q.error)}
        onRetry={() => void q.refetch()}
      />
    );

  const {
    customer,
    appointments,
    visits,
    lastVisit,
    spend,
    preferredBarber,
    notes,
    referencePhotos,
  } = q.data;

  return (
    <div className="space-y-6">
      <button
        onClick={() =>
          void navigate({ to: "/manage/$shopId/customers", params: { shopId } })
        }
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Customers
      </button>

      <ManageHeader
        title={customer.name}
        description="Your shop's relationship with this customer."
      />

      <section className="rounded-md border border-hairline bg-card p-4 sm:p-5 md:p-6">
        <div className="flex items-center gap-4">
          <Avatar className="size-14 shrink-0">
            {customer.photo && <AvatarImage src={customer.photo} alt="" />}
            <AvatarFallback className="bg-surface-strong font-semibold text-lg">
              {initials(customer.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <a
              href={`tel:${customer.phone}`}
              className="flex items-center gap-2 truncate text-sm font-medium hover:text-ink"
            >
              <Phone
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />{" "}
              {customer.phone}
            </a>
            <a
              href={`mailto:${customer.email}`}
              className="flex items-center gap-2 truncate text-sm text-muted-foreground hover:text-ink"
            >
              <Mail className="size-3.5 shrink-0" aria-hidden />{" "}
              {customer.email}
            </a>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Visits here" value={String(visits)} />
          <Stat
            label="Last visit"
            value={lastVisit ? dayLabel(lastVisit) : "—"}
          />
          <Stat label="Spend here" value={money(spend)} />
          <Stat label="Usual barber" value={preferredBarber?.name ?? "—"} />
        </dl>
      </section>

      <p className="flex items-start gap-2 rounded-md border border-hairline bg-card px-4 py-3 text-sm text-muted-foreground">
        <ShieldCheck
          className="mt-0.5 size-4 shrink-0 text-success"
          aria-hidden
        />
        This is your shop's record only. Visits this customer makes at other
        shops are never shown here.
      </p>

      {customer.preferences && (
        <section>
          <SectionTitle>Preferences they shared</SectionTitle>
          <p className="mt-2 rounded-md border border-hairline bg-card p-4 text-sm">
            {customer.preferences}
          </p>
        </section>
      )}

      <section>
        <SectionTitle>Shop notes</SectionTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Private to your team. The customer never sees these.
        </p>
        <div className="mt-3 rounded-md border border-hairline bg-card p-4">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Clipper guards, parting, products, anything worth remembering…"
            className="min-h-20"
            aria-label="Add a shop note"
          />
          <Button
            className="mt-3"
            size="sm"
            disabled={!note.trim() || saveNote.isPending}
            onClick={() => saveNote.mutate()}
          >
            <NotebookPen className="size-4" aria-hidden />
            {saveNote.isPending ? "Saving…" : "Add note"}
          </Button>
        </div>
        {notes.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {notes.map((n) => (
              <li
                key={n.id}
                className="rounded-sm border border-hairline bg-card p-3"
              >
                <p className="text-sm">{n.text}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {n.author} · {dayLabel(n.date)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle>Reference photos</SectionTitle>
        {referencePhotos.length === 0 ? (
          <EmptyState
            className="mt-2 py-8"
            icon={ImageOff}
            title="No reference photos"
            description="Photos a customer attaches to a booking with you appear here."
          />
        ) : (
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {referencePhotos.map((p) => (
              <figure
                key={p.id}
                className="overflow-hidden rounded-sm border border-hairline"
              >
                <img
                  src={p.url}
                  alt={p.caption ? p.caption : "Reference photo"}
                  loading="lazy"
                  className="aspect-[3/4] w-full object-cover"
                />
              </figure>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle>Appointment history at this shop</SectionTitle>
        {appointments.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No appointments with you yet.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {appointments.map((a) => (
              <li key={a.id}>
                <Link
                  to="/manage/$shopId/appointments/$appointmentId"
                  params={{ shopId, appointmentId: a.id }}
                  className="block rounded-sm border border-hairline bg-card p-3.5 transition-colors hover:border-ink"
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {a.completion?.actualService ??
                          a.service?.name ??
                          "Service"}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {longDate(a.date)} · {timeLabel(a.time)} ·{" "}
                        {a.barber.name}
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="mt-2 text-sm font-semibold">
                    {money(a.completion?.finalPrice ?? a.price)}
                  </p>
                  {a.completion?.notes && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      “{a.completion.notes}”
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="type-display-sm text-ink">{children}</h2>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-sm bg-surface-soft px-3 py-2.5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-semibold">{value}</dd>
    </div>
  );
}
