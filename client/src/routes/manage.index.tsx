import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ChevronRight, Scissors } from "lucide-react";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { shops } from "@/lib/mock-data";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/manage/")({
  head: () => ({
    meta: [
      { title: "Shop workspace — Drop" },
      { name: "description", content: "Pick the shop you want to manage." },
      { property: "og:title", content: "Shop workspace — Drop" },
      {
        property: "og:description",
        content: "Pick the shop you want to manage.",
      },
    ],
  }),
  component: ShopSelector,
});

function ShopSelector() {
  const { user, ready } = useSession();

  if (!ready) return null;
  if (!user) return <Navigate to="/auth" search={{ redirect: "/manage" }} />;

  if (user.memberships.length === 0) {
    return (
      <div className="page py-10">
        <EmptyState
          icon={Scissors}
          title="You're not part of a shop yet"
          description="Shop workspaces appear here when an owner adds you to their team."
          action={
            <Button asChild>
              <Link to="/">Back to discover</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (user.memberships.length === 1) {
    return <Navigate to="/manage/$shopId" params={{ shopId: user.memberships[0]!.shopId }} />;
  }

  return (
    <div className="page py-8">
      <h1 className="text-2xl font-semibold">Choose a shop</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        You manage {user.memberships.length} shops.
      </p>
      <ul className="mt-5 space-y-3">
        {user.memberships.map((m) => {
          const shop = shops.find((s) => s.id === m.shopId);
          return (
            <li key={m.shopId}>
              <Link
                to="/manage/$shopId"
                params={{ shopId: m.shopId }}
                className="flex items-center gap-3 rounded-md border border-hairline bg-card p-4 transition-colors hover:border-ink"
              >
                <img
                  src={shop?.photos[0]}
                  alt=""
                  loading="lazy"
                  className="size-14 shrink-0 rounded-sm object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{shop?.name}</p>
                  <p className="text-sm capitalize text-muted-foreground">{m.role}</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
