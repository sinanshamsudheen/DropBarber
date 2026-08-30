import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Users } from "lucide-react";
import { useState } from "react";
import { CustomerCard } from "@/components/cards/customer-card";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { ManageHeader } from "@/components/layout/manage-shell";
import { Input } from "@/components/ui/input";
import { listShopCustomers } from "@/lib/api";

export const Route = createFileRoute("/manage/$shopId/customers/")({
  component: CustomersPage,
});

function CustomersPage() {
  const { shopId } = Route.useParams();
  const [query, setQuery] = useState("");
  const q = useQuery({
    queryKey: ["shop-customers", shopId, query],
    queryFn: () => listShopCustomers(shopId, query),
  });

  return (
    <div>
      <ManageHeader
        title="Customers"
        description="Only visits to this shop are shown — never a customer's history elsewhere."
      />

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, phone or email"
          className="pl-9"
          aria-label="Search customers"
        />
      </div>

      <div className="mt-4">
        {q.isPending && <ListSkeleton rows={4} />}
        {q.isError && (
          <ErrorState message={(q.error as Error).message} onRetry={() => void q.refetch()} />
        )}
        {q.isSuccess && q.data.length === 0 && (
          <EmptyState
            icon={Users}
            title={query ? "No customers match that search" : "No customers yet"}
            description={
              query
                ? "Try a different name or phone number."
                : "Customers appear here after their first booking with you."
            }
          />
        )}
        <ul className="space-y-2">
          {q.data?.map((row) => (
            <li key={row.customer.id}>
              <CustomerCard shopId={shopId} row={row} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
