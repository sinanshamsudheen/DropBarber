import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { initials } from "@/components/cards/barber-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { dayLabel, money } from "@/lib/format";
import type { Barber, Customer } from "@/lib/types";

export interface ShopCustomerRow {
  customer: Customer;
  visits: number;
  lastVisit: string | null;
  lastAppointmentDate: string | null;
  preferredBarber: Barber | null;
  spend: number;
}

export function CustomerCard({ shopId, row }: { shopId: string; row: ShopCustomerRow }) {
  const { customer, visits, lastVisit, preferredBarber, spend } = row;
  return (
    <Link
      to="/manage/$shopId/customers/$customerId"
      params={{ shopId, customerId: customer.id }}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-accent/50"
    >
      <Avatar className="size-11 shrink-0">
        {customer.photo && <AvatarImage src={customer.photo} alt="" />}
        <AvatarFallback className="bg-secondary font-display">
          {initials(customer.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{customer.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {visits} visit{visits === 1 ? "" : "s"}
          {lastVisit ? ` · last ${dayLabel(lastVisit)}` : " · no completed visits yet"}
          {spend > 0 ? ` · ${money(spend)}` : ""}
        </p>
        {preferredBarber && (
          <p className="truncate text-xs text-muted-foreground">
            Usually sees {preferredBarber.name}
          </p>
        )}
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
