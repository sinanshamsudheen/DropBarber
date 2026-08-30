import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { History, Lock, ShieldCheck } from "lucide-react";
import { ReviewDialog } from "@/components/booking/review-dialog";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { CustomerShell, PageHeader } from "@/components/layout/customer-shell";
import { Button } from "@/components/ui/button";
import { getCustomerHistory } from "@/lib/api";
import { dayLabel, money, timeLabel } from "@/lib/format";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Your haircut history — Drop" },
      {
        name: "description",
        content: "Your personal history across every barber shop you've visited: shop, barber, service and price.",
      },
      { property: "og:title", content: "Your haircut history — Drop" },
      { property: "og:description", content: "Every past visit across shops, in one private timeline." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { user, ready } = useSession();
  const q = useQuery({ queryKey: ["history"], queryFn: () => getCustomerHistory(), enabled: !!user });

  return (
    <CustomerShell>
      <div className="page">
        <PageHeader title="History" description="This is your personal history across the shops you've visited." />

        <p className="mb-4 flex items-start gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          Only you can see this cross-shop view. Each shop only ever sees its own history with you.
        </p>

        {ready && !user && (
          <EmptyState
            icon={Lock}
            title="Log in to see your history"
            description="Your past visits across shops appear here."
            action={
              <Button asChild>
                <Link to="/auth">Log in</Link>
              </Button>
            }
          />
        )}

        {user && (
          <>
            {q.isPending && <ListSkeleton rows={3} />}
            {q.isError && <ErrorState message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
            {q.data?.length === 0 && (
              <EmptyState
                icon={History}
                title="No visits yet"
                description="Once you complete an appointment it'll appear here."
                action={
                  <Button asChild>
                    <Link to="/">Find a shop</Link>
                  </Button>
                }
              />
            )}
            <ul className="space-y-3">
              {q.data?.map((a) => (
                <li key={a.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{a.shop.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {dayLabel(a.date)} · {timeLabel(a.time)} · {a.barber.name}
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="mt-2 text-sm">
                    {a.completion?.actualService ?? a.service.name}
                    <span className="ms-2 font-semibold">{money(a.completion?.finalPrice ?? a.price)}</span>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/bookings/$appointmentId" params={{ appointmentId: a.id }}>
                        Details
                      </Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link
                        to="/shops/$shopId/book"
                        params={{ shopId: a.shopId }}
                        search={{ step: 1, serviceId: a.serviceId, barberId: a.barberId }}
                      >
                        Book again
                      </Link>
                    </Button>
                    {a.status === "completed" && !a.review && (
                      <ReviewDialog
                        appointmentId={a.id}
                        shopName={a.shop.name}
                        barberName={a.barber.name}
                        trigger={
                          <Button size="sm" variant="ghost">
                            Review
                          </Button>
                        }
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </CustomerShell>
  );
}
