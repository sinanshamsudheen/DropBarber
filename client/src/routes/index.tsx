import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Compass, LocateFixed, Map, Rows3, Store } from "lucide-react";
import { useState } from "react";
import { ShopCard } from "@/components/cards/shop-card";
import { EmptyState, ErrorState, GridSkeleton } from "@/components/common/states";
import { CustomerShell } from "@/components/layout/customer-shell";
import { ShopSearchBar } from "@/components/search/shop-search-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { listShops, nextAvailable, startingPrice } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Drop — Book a barber near you" },
      {
        name: "description",
        content:
          "Find barber shops nearby, compare barbers and prices, and book a real appointment slot in under a minute.",
      },
      { property: "og:title", content: "Drop — Book a barber near you" },
      {
        property: "og:description",
        content: "Discover local barber shops, pick your barber and book an available slot.",
      },
    ],
  }),
  component: DiscoverPage,
});

type LocationState = "idle" | "requesting" | "granted" | "denied";

const DEFAULT_AREA = "Indiranagar, Bengaluru";
const RATING_TABS = [
  { value: 0, label: "All shops" },
  { value: 4, label: "4.0 and up" },
  { value: 4.5, label: "4.5 and up" },
];

function DiscoverPage() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [locationState, setLocationState] = useState<LocationState>("granted");
  const [view, setView] = useState<"list" | "map">("list");
  const [maxDistance, setMaxDistance] = useState(10);
  const [minRating, setMinRating] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);

  const shopsQuery = useQuery({
    queryKey: ["shops", query, location],
    queryFn: async () => {
      const list = await listShops({ query, location });
      return Promise.all(
        list.map(async (shop) => ({
          shop,
          fromPrice: startingPrice(shop.id),
          next: await nextAvailable(shop.id),
        })),
      );
    },
  });

  const results = (shopsQuery.data ?? []).filter(
    (r) => r.shop.distanceKm <= maxDistance && r.shop.rating >= minRating,
  );

  const requestLocation = () => {
    setLocationState("requesting");
    setTimeout(() => {
      setLocationState("granted");
      setLocation("");
    }, 900);
  };

  const clearFilters = () => {
    setQuery("");
    setLocation("");
    setMaxDistance(10);
    setMinRating(0);
  };

  return (
    <CustomerShell
      search={
        <ShopSearchBar
          location={location}
          onLocationChange={setLocation}
          query={query}
          onQueryChange={setQuery}
          onSubmit={() => void shopsQuery.refetch()}
          onUseMyLocation={requestLocation}
          locating={locationState === "requesting"}
          onExpand={() => setSheetOpen(true)}
          placeholderLocation={DEFAULT_AREA}
        />
      }
    >
      {/* Category strip: quick rating tabs left, view toggle right. */}
      <div className="border-b border-hairline">
        <div className="page flex items-center justify-between gap-6 overflow-x-auto">
          <div role="tablist" aria-label="Filter by rating" className="flex shrink-0 gap-8">
            {RATING_TABS.map((tab) => {
              const active = minRating === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMinRating(tab.value)}
                  className={cn(
                    "shrink-0 border-b-2 pb-4 pt-5 text-sm font-medium transition-colors",
                    active
                      ? "border-ink text-ink"
                      : "border-transparent text-muted-foreground hover:border-hairline hover:text-ink",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex shrink-0 items-center gap-2 py-3">
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full"
              onClick={() => setSheetOpen(true)}
            >
              Within {maxDistance} km
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full"
              onClick={() => setView(view === "list" ? "map" : "list")}
            >
              {view === "list" ? (
                <>
                  <Map className="size-4" aria-hidden />
                  Map
                </>
              ) : (
                <>
                  <Rows3 className="size-4" aria-hidden />
                  List
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="page pb-12 pt-6 sm:pb-16 sm:pt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="type-display-xl text-ink">Barbers in {location || DEFAULT_AREA}</h1>
          <Button variant="link" size="sm" className="px-0" onClick={requestLocation}>
            <LocateFixed className="size-4" aria-hidden />
            {locationState === "requesting" ? "Finding you…" : "Use my location"}
          </Button>
        </div>

        {locationState === "denied" && (
          <p className="mt-4 rounded-md border border-hairline bg-surface-soft px-4 py-3 text-sm text-body">
            Location is unavailable. Search a neighbourhood to keep browsing.
          </p>
        )}

        {view === "map" && (
          <div className="mt-6 overflow-hidden rounded-md border border-hairline">
            <div className="grid h-72 place-items-center bg-surface-soft">
              <div className="text-center">
                <Compass className="mx-auto size-6 text-muted-foreground" aria-hidden />
                <p className="type-title-md mt-3 text-ink">Map view</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pins connect to the maps provider once the backend supplies coordinates.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8">
          {shopsQuery.isPending && <GridSkeleton cards={8} />}

          {shopsQuery.isError && (
            <ErrorState
              title="Search failed"
              message={(shopsQuery.error as Error).message}
              onRetry={() => void shopsQuery.refetch()}
            />
          )}

          {shopsQuery.isSuccess && results.length === 0 && (
            <EmptyState
              icon={Store}
              title="No barber shops found near this location"
              description="Try a wider distance, a different neighbourhood, or clear your search."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          )}

          {shopsQuery.isSuccess && results.length > 0 && (
            <>
              <p className="pb-6 text-sm text-muted-foreground">
                {results.length} shop{results.length === 1 ? "" : "s"} nearby
              </p>
              <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3 xl:grid-cols-4">
                {results.map((r) => (
                  <ShopCard key={r.shop.id} shop={r.shop} fromPrice={r.fromPrice} next={r.next} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile search + filter surface, opened by the collapsed pill. */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader className="text-left">
            <SheetTitle className="type-display-sm">Search</SheetTitle>
            <SheetDescription>Narrow down the shops near you.</SheetDescription>
          </SheetHeader>
          <div className="space-y-6 pb-8 pt-6">
            <div>
              <Label htmlFor="filter-where">Where</Label>
              <Input
                id="filter-where"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={DEFAULT_AREA}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="filter-what">What</Label>
              <Input
                id="filter-what"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Shop name or service"
                className="mt-2"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">Within {maxDistance} km</p>
              <Slider
                className="mt-4"
                value={[maxDistance]}
                min={1}
                max={10}
                step={1}
                onValueChange={([v]) => setMaxDistance(v ?? 10)}
                aria-label="Maximum distance"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">Minimum rating</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {RATING_TABS.map((tab) => (
                  <Button
                    key={tab.value}
                    type="button"
                    size="sm"
                    variant={minRating === tab.value ? "outline" : "secondary"}
                    className="rounded-full"
                    onClick={() => setMinRating(tab.value)}
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-hairline pt-5">
              <Button variant="link" className="px-0" onClick={clearFilters}>
                Clear all
              </Button>
              <Button onClick={() => setSheetOpen(false)}>Show {results.length} shops</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </CustomerShell>
  );
}
