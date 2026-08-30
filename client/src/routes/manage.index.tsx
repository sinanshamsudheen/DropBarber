import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ChevronRight, Scissors } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/common/states";
import { CreateShopDialog } from "@/components/manage/create-shop-dialog";
import { Button } from "@/components/ui/button";
import { listMyShopsApiV1MyShopsGetQueryOptions } from "@/lib/api/generated/hooks/useListMyShopsApiV1MyShopsGet";
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
  const [createOpen, setCreateOpen] = useState(false);
  const myShopsQuery = useQuery({
    ...listMyShopsApiV1MyShopsGetQueryOptions({}),
    enabled: !!user,
  });
  const myShops = myShopsQuery.data?.data ?? [];

  if (!ready) return null;
  if (!user) return <Navigate to="/auth" search={{ redirect: "/manage" }} />;

  if (user.memberships.length === 0) {
    return (
      <div className="page py-8 sm:py-10">
        <EmptyState
          icon={Scissors}
          title="You're not part of a shop yet"
          description="Shop workspaces appear here when an owner adds you to their team — or start your own below."
          action={
            <div className="flex flex-col items-center gap-2 sm:flex-row">
              <Button onClick={() => setCreateOpen(true)}>
                Create your shop
              </Button>
              <Button asChild variant="outline">
                <Link to="/">Back to discover</Link>
              </Button>
            </div>
          }
        />
        <CreateShopDialog open={createOpen} onOpenChange={setCreateOpen} />
      </div>
    );
  }

  if (user.memberships.length === 1) {
    return (
      <Navigate
        to="/manage/$shopId"
        params={{ shopId: user.memberships[0]!.shopId }}
      />
    );
  }

  return (
    <div className="page py-8 sm:py-10">
      <h1 className="text-2xl font-semibold">Choose a shop</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        You manage {user.memberships.length} shops.
      </p>
      <ul className="mt-5 space-y-3">
        {user.memberships.map((m) => {
          const shop = myShops.find((s) => s.id === m.shopId);
          return (
            <li key={m.shopId}>
              <Link
                to="/manage/$shopId"
                params={{ shopId: m.shopId }}
                className="flex items-center gap-3 rounded-md border border-hairline bg-card p-4 transition-colors hover:border-ink sm:p-5"
              >
                <span className="grid size-14 shrink-0 place-items-center rounded-sm bg-surface-strong">
                  <Scissors
                    className="size-5 text-muted-foreground"
                    aria-hidden
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{shop?.name}</p>
                  <p className="text-sm capitalize text-muted-foreground">
                    {m.role}
                  </p>
                </div>
                <ChevronRight
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
