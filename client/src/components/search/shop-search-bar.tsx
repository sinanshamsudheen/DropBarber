import { LocateFixed, Search, SlidersHorizontal } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
 * DESIGN.md search-bar-pill: white fill, fully rounded, 64px tall, carrying the
 * system's one shadow tier. Divided by a vertical hairline into
 * search-field-segment cells, each holding a caption label above its input.
 * A circular Rausch search-orb terminates the right edge — the hottest single
 * colour moment on the page.
 *
 * The upstream pattern runs Where / When / Who. Drop picks dates inside the
 * booking flow rather than at search time, so this bar runs the two segments the
 * product actually filters on: Where and What.
 *
 * Below 744px the whole bar collapses to one tappable pill, per the responsive
 * spec — the caller opens its filter surface from `onExpand`.
 */

export function ShopSearchBar({
  location,
  onLocationChange,
  query,
  onQueryChange,
  onSubmit,
  onUseMyLocation,
  locating,
  onExpand,
  filters,
  filterCount = 0,
  placeholderLocation,
}: {
  location: string;
  onLocationChange: (v: string) => void;
  query: string;
  onQueryChange: (v: string) => void;
  onSubmit: () => void;
  onUseMyLocation: () => void;
  locating?: boolean;
  onExpand: () => void;
  filters?: React.ReactNode;
  filterCount?: number;
  placeholderLocation: string;
}) {
  const whereId = useId();
  const whatId = useId();
  const [focused, setFocused] = useState<"where" | "what" | null>(null);

  return (
    <>
      {/* Mobile: a single tappable pill that opens the full search surface. */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={onExpand}
          className="flex h-14 w-full items-center gap-3 rounded-full border border-hairline bg-background px-5 text-left shadow-float"
        >
          <Search className="size-4 shrink-0 text-ink" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">
              {query || "Search barber shops"}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {location || placeholderLocation}
            </span>
          </span>
          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-hairline">
            <SlidersHorizontal className="size-3.5 text-ink" aria-hidden />
          </span>
        </button>
      </div>

      {/* Desktop: the full pill with hairline-divided segments and the orb. */}
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className={cn(
          "hidden h-16 items-center rounded-full border border-hairline bg-background pl-2 pr-2 transition-shadow md:flex",
          focused ? "shadow-float" : "hover:shadow-float",
        )}
      >
        <div
          className={cn(
            "min-w-0 flex-[1.1] rounded-full px-6 py-2 transition-colors",
            focused === "where" ? "bg-surface-soft" : "hover:bg-surface-soft",
          )}
        >
          <label htmlFor={whereId} className="block text-sm font-medium text-ink">
            Where
          </label>
          <input
            id={whereId}
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
            onFocus={() => setFocused("where")}
            onBlur={() => setFocused(null)}
            placeholder={placeholderLocation}
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted-foreground"
          />
        </div>

        <span className="h-8 w-px shrink-0 bg-hairline" aria-hidden />

        <div
          className={cn(
            "min-w-0 flex-1 rounded-full px-6 py-2 transition-colors",
            focused === "what" ? "bg-surface-soft" : "hover:bg-surface-soft",
          )}
        >
          <label htmlFor={whatId} className="block text-sm font-medium text-ink">
            What
          </label>
          <input
            id={whatId}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => setFocused("what")}
            onBlur={() => setFocused(null)}
            placeholder="Shop name or service"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex shrink-0 items-center gap-2 pl-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            onClick={onUseMyLocation}
            disabled={locating}
            aria-label="Use my location"
            title="Use my location"
          >
            <LocateFixed className="size-4" aria-hidden />
          </Button>
          <Button type="submit" variant="orb" size="orb" aria-label="Search">
            <Search aria-hidden />
          </Button>
        </div>
      </form>

      {/* The filter rail sits under the bar on desktop, inside the sheet on mobile. */}
      {filters && (
        <div className="mt-4 hidden items-center gap-3 md:flex">
          {filters}
          {filterCount > 0 && (
            <span className="text-sm text-muted-foreground">
              {filterCount} filter{filterCount === 1 ? "" : "s"} applied
            </span>
          )}
        </div>
      )}
    </>
  );
}
