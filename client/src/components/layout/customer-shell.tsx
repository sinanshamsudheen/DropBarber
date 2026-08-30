import { Link, useRouterState } from "@tanstack/react-router";
import { User } from "lucide-react";
import type { ReactNode } from "react";
import { PRODUCT_TABS, SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { cn } from "@/lib/utils";

/*
 * Mobile keeps a bottom tab bar — the responsive spec collapses the desktop
 * product tabs below 744px, and a marketplace this booking-heavy needs its
 * sections one thumb away.
 */
const BOTTOM_NAV = [
  ...PRODUCT_TABS,
  {
    to: "/profile",
    label: "Profile",
    icon: User,
    match: (p: string) => p.startsWith("/profile"),
  },
] as const;

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto flex max-w-2xl">
        {BOTTOM_NAV.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors",
                  active ? "text-brand" : "text-muted-foreground hover:text-ink",
                )}
              >
                <item.icon className="size-5 stroke-[1.5]" aria-hidden />
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
  hideHeader,
  hideFooter,
  search,
  className,
}: {
  children: ReactNode;
  /** Hide the mobile bottom bar — used by focused flows like booking. */
  hideNav?: boolean;
  /** Hide the top nav — used by flows that carry their own sticky header. */
  hideHeader?: boolean;
  hideFooter?: boolean;
  /** Rendered inside the header band, beneath the nav rule. */
  search?: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {!hideHeader && <SiteHeader search={search} />}
      <main className={cn("flex-1", hideNav ? "" : "pb-24 md:pb-0", className)}>{children}</main>
      {!hideFooter && <SiteFooter />}
      {!hideNav && <MobileBottomNav />}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
  variant = "standalone",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  /** "embedded" is for shells (like ManageShell) that already provide their own top padding. */
  variant?: "standalone" | "embedded";
}) {
  return (
    <header
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:gap-4",
        variant === "standalone" ? "py-6 sm:py-8" : "pb-4 sm:pb-6",
      )}
    >
      <div className="min-w-0">
        <h1 className="type-display-xl truncate text-ink">{title}</h1>
        {description && <p className="mt-1 text-base text-muted-foreground">{description}</p>}
      </div>
      {action}
    </header>
  );
}
