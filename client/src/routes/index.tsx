import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Compass, LocateFixed, MapPin, Search, SlidersHorizontal, Store } from "lucide-react";
import { useState } from "react";
import { ShopCard } from "@/components/cards/shop-card";
import { EmptyState, ErrorState, GridSkeleton } from "@/components/common/states";
import { CustomerShell } from "@/components/layout/customer-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listShops, nextAvailable, startingPrice } from "@/lib/api";
import { useSession } from "@/lib/session";

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

function DiscoverPage() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [locationState, setLocationState] = useState<LocationState>("granted");
  const [view, setView] = useState<"list" | "map">("list");
  const [maxDistance, setMaxDistance] = useState(10);
  const [minRating, setMinRating] = useState(0);
  const { user } = useSession();

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

  return (
    <CustomerShell>
      <div className="border-b border-border bg-card">
        <div className="page pb-4 pt-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {locationState === "requesting" ? "Finding you…" : "Showing shops near"}
              </p>
              <p className="flex items-center gap-1.5 truncate text-lg font-semibold">
                <MapPin className="size-4 shrink-0 text-accent" aria-hidden />
                {location || "Indiranagar, Bengaluru"}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={requestLocation} disabled={locationState === "requesting"}>
              <LocateFixed className="size-4" aria-hidden />
              <span className="hidden sm:inline">Use my location</span>
            </Button>
          </div>

          {locationState === "denied" && (
            <p className="mt-3 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
              Location is unavailable. Search a neighbourhood below to keep browsing.
            </p>
          )}

          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <div className="relative min-w-0">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search shops or a service"
                aria-label="Search barber shops"
                className="h-11 rounded-xl pl-9"
              />
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="size-11 rounded-xl" aria-label="Filters">
                  <SlidersHorizontal className="size-4" aria-hidden />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                  <SheetDescription>Narrow down the shops near you.</SheetDescription>
                </SheetHeader>
                <div className="space-y-6 px-4 pb-8">
                  <div>
                    <label className="text-sm font-medium" htmlFor="loc">
                      Search another location
                    </label>
                    <Input
                      id="loc"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Koramangala"
                      className="mt-2 h-11 rounded-xl"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Within {maxDistance} km</p>
                    <Slider
                      className="mt-3"
                      value={[maxDistance]}
                      min={1}
                      max={10}
                      step={1}
                      onValueChange={([v]) => setMaxDistance(v ?? 10)}
                      aria-label="Maximum distance"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Minimum rating</p>
                    <div className="mt-2 flex gap-2">
                      {[0, 4, 4.5].map((r) => (
                        <Button
                          key={r}
                          type="button"
                          size="sm"
                          variant={minRating === r ? "default" : "outline"}
                          onClick={() => setMinRating(r)}
                        >
                          {r === 0 ? "Any" : `${r}+`}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <Tabs value={view} onValueChange={(v) => setView(v as "list" | "map")}>
              <TabsList>
                <TabsTrigger value="list">List</TabsTrigger>
                <TabsTrigger value="map">Map</TabsTrigger>
              </TabsList>
            </Tabs>
            {!user && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth">Log in</Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="page pt-4">
        {view === "map" && (
          <div className="mb-4 overflow-hidden rounded-2xl border border-border">
            <div className="relative grid h-56 place-items-center bg-secondary">
              <div className="text-center">
                <Compass className="mx-auto size-6 text-muted-foreground" aria-hidden />
                <p className="mt-2 text-sm font-medium">Map view</p>
                <p className="text-xs text-muted-foreground">
                  Pins connect to the maps provider once the backend supplies coordinates.
                </p>
              </div>
            </div>
          </div>
        )}

        {shopsQuery.isPending && <GridSkeleton cards={3} />}

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
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setLocation("");
                  setMaxDistance(10);
                  setMinRating(0);
                }}
              >
                Clear filters
              </Button>
            }
          />
        )}

        {shopsQuery.isSuccess && results.length > 0 && (
          <>
            <p className="pb-3 text-sm text-muted-foreground">
              {results.length} shop{results.length === 1 ? "" : "s"} nearby
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {results.map((r) => (
                <ShopCard key={r.shop.id} shop={r.shop} fromPrice={r.fromPrice} next={r.next} />
              ))}
            </div>
          </>
        )}
      </div>
    </CustomerShell>
  );
}
