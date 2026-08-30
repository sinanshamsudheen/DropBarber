import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CalendarRange,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Scissors,
  Settings,
  ShieldAlert,
  Star,
  Store,
  Trophy,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { shops } from "@/lib/mock-data";
import { useSession, type Permission } from "@/lib/session";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: Permission;
  primary?: boolean;
}

const ITEMS: NavItem[] = [
  {
    to: "/manage/$shopId",
    label: "Today",
    icon: LayoutDashboard,
    primary: true,
  },
  {
    to: "/manage/$shopId/appointments",
    label: "Appointments",
    icon: CalendarRange,
    primary: true,
  },
  {
    to: "/manage/$shopId/customers",
    label: "Customers",
    icon: Users,
    permission: "customers:view",
    primary: true,
  },
  {
    to: "/manage/$shopId/barbers",
    label: "Barbers",
    icon: Scissors,
    permission: "barbers:manage",
  },
  {
    to: "/manage/$shopId/services",
    label: "Services",
    icon: Store,
    permission: "services:manage",
  },
  {
    to: "/manage/$shopId/schedule",
    label: "Schedule",
    icon: CalendarRange,
    permission: "schedule:manage",
  },
  {
    to: "/manage/$shopId/reviews",
    label: "Reviews",
    icon: Star,
    permission: "reviews:view",
  },
  { to: "/manage/$shopId/points", label: "Points", icon: Trophy },
  {
    to: "/manage/$shopId/settings",
    label: "Settings",
    icon: Settings,
    permission: "settings:manage",
  },
];

function useVisibleItems(shopId: string) {
  const { can } = useSession();
  return ITEMS.filter((i) => !i.permission || can(shopId, i.permission));
}

function isActive(pathname: string, to: string, shopId: string) {
  const resolved = to.replace("$shopId", shopId);
  return to.endsWith("$shopId") ? pathname === resolved : pathname.startsWith(resolved);
}

export function ManageShell({ shopId, children }: { shopId: string; children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = useVisibleItems(shopId);
  const { user, logout, membershipFor } = useSession();
  const navigate = useNavigate();
  const shop = shops.find((s) => s.id === shopId);
  const membership = membershipFor(shopId);
  const memberships = user?.memberships ?? [];

  const primary = items.filter((i) => i.primary).slice(0, 3);
  const overflow = items.filter((i) => !primary.includes(i));

  return (
    <div className="min-h-screen bg-surface-soft">
      <header className="sticky top-0 z-30 border-b border-hairline bg-background">
        <div className="page-wide grid h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex min-w-0 items-center gap-3 rounded-full px-2 py-2 text-left transition-colors hover:bg-surface-soft">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber text-on-amber">
                    <Scissors className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="type-title-md block truncate text-ink">
                      {shop?.name ?? "Shop"}
                    </span>
                    <span className="block truncate text-sm capitalize text-muted-foreground">
                      {membership?.role ?? "staff"} workspace
                    </span>
                  </span>
                  {memberships.length > 1 && (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60">
                <DropdownMenuLabel>Your shops</DropdownMenuLabel>
                {memberships.map((m) => (
                  <DropdownMenuItem
                    key={m.shopId}
                    onClick={() =>
                      navigate({
                        to: "/manage/$shopId",
                        params: { shopId: m.shopId },
                      })
                    }
                  >
                    <span className="flex-1 truncate">
                      {shops.find((s) => s.id === m.shopId)?.name}
                    </span>
                    <span className="text-sm capitalize text-muted-foreground">{m.role}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/" })}>
                  <Store className="size-4" /> Customer marketplace
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    logout();
                    navigate({ to: "/auth" });
                  }}
                >
                  <LogOut className="size-4" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="hidden rounded-full sm:inline-flex"
          >
            <Link to="/">Exit to marketplace</Link>
          </Button>
        </div>
      </header>

      <div className="page-wide flex gap-10 py-8">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav aria-label="Shop management" className="sticky top-28 space-y-1">
            {items.map((item) => {
              const active = isActive(pathname, item.to, shopId);
              return (
                <Link
                  key={item.to}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  to={item.to as any}
                  params={{ shopId } as never}
                  className={cn(
                    "flex items-center gap-3 rounded-full px-4 py-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-ink text-on-ink"
                      : "text-muted-foreground hover:bg-surface-strong hover:text-ink",
                  )}
                >
                  <item.icon className="size-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 pb-24 md:pb-8">{children}</main>
      </div>

      <nav
        aria-label="Shop management"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="flex">
          {primary.map((item) => {
            const active = isActive(pathname, item.to, shopId);
            return (
              <li key={item.to} className="flex-1">
                <Link
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  to={item.to as any}
                  params={{ shopId } as never}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                    active ? "text-ink" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="size-5" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex min-h-14 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground">
                <MoreHorizontal className="size-5" aria-hidden />
                More
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-52">
                {overflow.map((item) => (
                  <DropdownMenuItem
                    key={item.to}
                    onClick={() =>
                      navigate({
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        to: item.to as any,
                        params: { shopId } as never,
                      })
                    }
                  >
                    <item.icon className="size-4" /> {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        </ul>
      </nav>
    </div>
  );
}

/**
 * UX-layer guard only. Direct URL access to a screen the user can't use gets a
 * readable dead end instead of a broken page — the real check is the backend's.
 */
export function RequirePermission({
  shopId,
  permission,
  children,
}: {
  shopId: string;
  permission: Permission;
  children: ReactNode;
}) {
  const { can } = useSession();
  if (!can(shopId, permission)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="You don't have access to this section"
        description="Your role at this shop doesn't include this. Ask the owner if you need it."
        action={
          <Button asChild variant="secondary">
            <Link to="/manage/$shopId" params={{ shopId }}>
              Back to today
            </Link>
          </Button>
        }
      />
    );
  }
  return <>{children}</>;
}

export function ManageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 pb-6">
      <div className="min-w-0">
        <h1 className="type-display-xl truncate text-ink">{title}</h1>
        {description && <p className="mt-1 text-base text-muted-foreground">{description}</p>}
      </div>
      {action}
    </header>
  );
}
