import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarCheck, Clock3, Compass, User } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Discover", icon: Compass, match: (p: string) => p === "/" || p.startsWith("/shops") },
  { to: "/bookings", label: "Bookings", icon: CalendarCheck, match: (p: string) => p.startsWith("/bookings") },
  { to: "/history", label: "History", icon: Clock3, match: (p: string) => p.startsWith("/history") },
  { to: "/profile", label: "Profile", icon: User, match: (p: string) => p.startsWith("/profile") },
];

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-2xl">
        {NAV.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                  active ? "text-accent" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon className="size-5" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function CustomerShell({
  children,
  hideNav,
  className,
}: {
  children: ReactNode;
  hideNav?: boolean;
  className?: string;
}) {
  return (
    <div className="min-h-screen bg-background">
      <main className={cn("pb-24", className)}>{children}</main>
      {!hideNav && <MobileBottomNav />}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-5">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </header>
  );
}
