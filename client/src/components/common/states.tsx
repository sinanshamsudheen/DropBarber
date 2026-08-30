import type { LucideIcon } from "lucide-react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-md border border-dashed border-hairline bg-surface-soft px-6 py-16 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="mb-4 grid size-12 place-items-center rounded-full bg-surface-strong text-ink">
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <h3 className="type-display-sm text-ink">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-base text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: (() => void) | undefined;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-md border border-destructive/25 bg-destructive/5 px-6 py-8 text-center",
        className,
      )}
    >
      <span className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" aria-hidden />
      </span>
      <h3 className="type-display-sm text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-base text-muted-foreground">
        {message ?? "We couldn't load this right now. Please try again."}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw className="size-4" aria-hidden /> Try again
        </Button>
      )}
    </div>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div>
      <Skeleton className="mb-3 aspect-square w-full rounded-md" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("mb-2 h-4", i === 0 ? "w-2/3" : i === 1 ? "w-1/2" : "w-1/3")}
        />
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-md border border-hairline bg-card p-4"
        >
          <Skeleton className="size-14 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function GridSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div
      className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: cards }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
