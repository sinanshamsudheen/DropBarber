import { createFileRoute, Link, Navigate, Outlet } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/common/states";
import { ManageShell } from "@/components/layout/manage-shell";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/manage/$shopId")({
  head: () => ({
    meta: [
      { title: "Shop management — Drop" },
      { name: "description", content: "Run your shop: appointments, customers, barbers and services." },
      { property: "og:title", content: "Shop management — Drop" },
      { property: "og:description", content: "Appointments, customers, barbers and services in one place." },
    ],
  }),
  component: ManageLayout,
});

function ManageLayout() {
  const { shopId } = Route.useParams();
  const { user, ready, membershipFor } = useSession();

  if (!ready) return null;
  if (!user) return <Navigate to="/auth" search={{ redirect: `/manage/${shopId}` }} />;

  if (!membershipFor(shopId)) {
    return (
      <div className="page py-10 sm:py-12">
        <EmptyState
          icon={ShieldAlert}
          title="You don't have access to this shop"
          description="Ask the owner to add you to the team, or switch to a shop you belong to."
          action={
            <Button asChild>
              <Link to="/manage">Your shops</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <ManageShell shopId={shopId}>
      <Outlet />
    </ManageShell>
  );
}
