import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarPlus, Lock } from "lucide-react";
import { AppointmentCard } from "@/components/cards/appointment-card";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { CustomerShell, PageHeader } from "@/components/layout/customer-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listCustomerAppointments } from "@/lib/api";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/bookings/")({
  head: () => ({
    meta: [
      { title: "Your bookings — Drop" },
      { name: "description", content: "Upcoming and past barber appointments, all in one place." },
      { property: "og:title", content: "Your bookings — Drop" },
      { property: "og:description", content: "Track upcoming and past barber appointments." },
    ],
  }),
  component: BookingsPage,
});

function BookingsPage() {
  const { user, ready } = useSession();
  const q = useQuery({
    queryKey: ["customer-appointments"],
    queryFn: () => listCustomerAppointments(),
    enabled: !!user,
  });

  return (
    <CustomerShell>
      <div className="page">
        <PageHeader title="Bookings" description="Your appointments across every shop you book." />

        {ready && !user && (
          <EmptyState
            icon={Lock}
            title="Log in to see your bookings"
            description="Your upcoming and past appointments live here once you're signed in."
            action={
              <Button asChild>
                <Link to="/auth">Log in</Link>
              </Button>
            }
          />
        )}

        {user && (
          <Tabs defaultValue="upcoming">
            <TabsList className="w-full">
              <TabsTrigger value="upcoming" className="flex-1">
                Upcoming
              </TabsTrigger>
              <TabsTrigger value="past" className="flex-1">
                Past
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="space-y-3 pt-4">
              {q.isPending && <ListSkeleton rows={2} />}
              {q.isError && <ErrorState message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
              {q.data?.upcoming.length === 0 && (
                <EmptyState
                  icon={CalendarPlus}
                  title="You don't have any upcoming appointments."
                  description="Find a shop nearby and book your next cut."
                  action={
                    <Button asChild>
                      <Link to="/">Discover shops</Link>
                    </Button>
                  }
                />
              )}
              {q.data?.upcoming.map((a) => (
                <AppointmentCard key={a.id} appointment={a} />
              ))}
            </TabsContent>

            <TabsContent value="past" className="space-y-3 pt-4">
              {q.isPending && <ListSkeleton rows={2} />}
              {q.data?.past.length === 0 && (
                <EmptyState title="No past appointments yet" description="Completed visits will show up here." />
              )}
              {q.data?.past.map((a) => (
                <AppointmentCard key={a.id} appointment={a} />
              ))}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </CustomerShell>
  );
}
