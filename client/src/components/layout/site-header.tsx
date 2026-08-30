import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarCheck, Clock3, Compass, Menu, Scissors, User } from "lucide-react";
import type { ReactNode } from "react";
import { initials } from "@/components/cards/barber-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

/*
 * DESIGN.md top-nav: white surface, 80px, 1px bottom hairline. Wordmark flush
 * left, the product tabs dead centre, account utilities flush right. Below
 * 744px the tabs collapse into a sheet and the bottom nav takes over.
 */

export const PRODUCT_TABS = [
  {
    to: "/",
    label: "Shops",
    icon: Compass,
    isNew: false,
    match: (p: string) => p === "/" || p.startsWith("/shops"),
  },
  {
    to: "/bookings",
    label: "Bookings",
    icon: CalendarCheck,
    isNew: false,
    match: (p: string) => p.startsWith("/bookings"),
  },
  {
    to: "/history",
    label: "History",
    icon: Clock3,
    isNew: true,
    match: (p: string) => p.startsWith("/history"),
  },
] as const;

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      aria-label="Drop — home"
      className={cn("inline-flex items-center gap-2 text-brand", className)}
    >
      <Scissors className="size-7 shrink-0" aria-hidden />
      <span className="text-[22px] font-bold leading-none tracking-tight">drop</span>
    </Link>
  );
}

function ProductTab({ tab }: { tab: (typeof PRODUCT_TABS)[number] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = tab.match(pathname);
  return (
    <Link
      to={tab.to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex flex-col items-center gap-1 pb-2 pt-1 transition-colors",
        active ? "text-ink" : "text-muted-foreground hover:text-ink",
      )}
    >
      <span className="relative">
        <tab.icon className="size-8 stroke-[1.25]" aria-hidden />
        {tab.isNew && (
          <Badge variant="tag" className="absolute -right-6 -top-1.5 shadow-float">
            New
          </Badge>
        )}
      </span>
      <span className="text-base font-semibold leading-tight">{tab.label}</span>
      <span
        className={cn(
          "absolute inset-x-0 bottom-0 h-0.5 rounded-full transition-colors",
          active ? "bg-ink" : "bg-transparent group-hover:bg-hairline",
        )}
        aria-hidden
      />
    </Link>
  );
}

function AccountCluster() {
  const { user } = useSession();
  if (!user) {
    return (
      <div className="flex items-center gap-1">
        <Button asChild variant="ghost" size="sm" className="rounded-full">
          <Link to="/auth">Log in</Link>
        </Button>
        <Button asChild variant="pill" size="pill" className="hidden sm:inline-flex">
          <Link to="/auth">Sign up</Link>
        </Button>
      </div>
    );
  }
  return (
    <Link
      to="/profile"
      className="flex items-center gap-2 rounded-full border border-hairline p-1.5 pl-3 transition-shadow hover:shadow-float"
    >
      <Menu className="size-4 text-ink" aria-hidden />
      <Avatar className="size-8">
        {user.photo && <AvatarImage src={user.photo} alt="" />}
        <AvatarFallback className="text-sm">{initials(user.name)}</AvatarFallback>
      </Avatar>
      <span className="sr-only">Your profile</span>
    </Link>
  );
}

function MobileMenu() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary" size="icon-sm" className="rounded-full" aria-label="Open menu">
          <Menu className="size-4" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80">
        <SheetHeader className="text-left">
          <SheetTitle className="type-display-sm">Browse</SheetTitle>
        </SheetHeader>
        <nav className="mt-6 flex flex-col">
          {[
            ...PRODUCT_TABS,
            {
              to: "/profile",
              label: "Profile",
              icon: User,
              match: (p: string) => p.startsWith("/profile"),
            },
          ].map((tab) => {
            const active = tab.match(pathname);
            return (
              <SheetClose asChild key={tab.to}>
                <Link
                  to={tab.to}
                  className={cn(
                    "flex items-center gap-4 border-b border-hairline-soft py-4 text-base font-medium transition-colors",
                    active ? "text-ink" : "text-muted-foreground hover:text-ink",
                  )}
                >
                  <tab.icon className="size-6 stroke-[1.5]" aria-hidden />
                  {tab.label}
                </Link>
              </SheetClose>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export function SiteHeader({ search }: { search?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-background">
      <div className="page">
        {/* Desktop: wordmark · product tabs · account, on an 80px rule. */}
        <div className="hidden h-20 grid-cols-3 items-center md:grid">
          <Wordmark />
          <nav
            aria-label="Products"
            className="flex items-end justify-center gap-8 self-stretch pt-4"
          >
            {PRODUCT_TABS.map((tab) => (
              <ProductTab key={tab.to} tab={tab} />
            ))}
          </nav>
          <div className="flex justify-end">
            <AccountCluster />
          </div>
        </div>

        {/* Mobile: hamburger sheet + wordmark + account. */}
        <div className="flex h-16 items-center justify-between gap-3 md:hidden">
          <MobileMenu />
          <Wordmark />
          <AccountCluster />
        </div>
      </div>

      {search && (
        <div className="page pb-4 md:pb-6">
          <div className="mx-auto w-full max-w-3xl">{search}</div>
        </div>
      )}
    </header>
  );
}
