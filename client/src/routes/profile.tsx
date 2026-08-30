import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Clock3, Lock, LogOut, ShieldCheck, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { initials } from "@/components/cards/barber-card";
import { ReferencePhotoUploader } from "@/components/common/photo-uploader";
import { EmptyState, ListSkeleton } from "@/components/common/states";
import { CustomerShell, PageHeader } from "@/components/layout/customer-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getCustomerProfile, saveCustomerProfile, CURRENT_CUSTOMER_ID } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Photo } from "@/lib/types";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — Drop" },
      {
        name: "description",
        content: "Manage your details, saved style photos and privacy settings.",
      },
      { property: "og:title", content: "Your profile — Drop" },
      {
        property: "og:description",
        content: "Your details, saved style photos and privacy controls.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, ready, logout } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ["profile"],
    queryFn: () => getCustomerProfile(),
    enabled: !!user,
  });

  const [preferences, setPreferences] = useState("");
  const [phone, setPhone] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [shareHistory, setShareHistory] = useState(true);

  useEffect(() => {
    if (q.data) {
      setPreferences(q.data.preferences);
      setPhone(q.data.phone);
      setPhotos(q.data.savedPhotos);
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: () =>
      saveCustomerProfile(CURRENT_CUSTOMER_ID, {
        preferences,
        phone,
        savedPhotos: photos,
      }),
    onSuccess: () => {
      toast.success("Profile saved");
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (ready && !user) {
    return (
      <CustomerShell>
        <div className="page-narrow pb-16">
          <PageHeader title="Profile" />
          <EmptyState
            icon={Lock}
            title="Log in to manage your profile"
            description="Save your preferences, style photos and see your history."
            action={
              <Button asChild>
                <Link to="/auth">Log in</Link>
              </Button>
            }
          />
        </div>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell>
      <div className="page-narrow pb-16">
        <PageHeader title="Profile" />

        {q.isPending && <ListSkeleton rows={3} />}

        {q.data && (
          <div className="space-y-10">
            <div className="flex items-center gap-5 rounded-md border border-hairline bg-card p-6">
              <Avatar className="size-16">
                <AvatarFallback className="text-lg">
                  {initials(user?.name ?? q.data.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="type-display-sm truncate text-ink">{user?.name ?? q.data.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {user?.email ?? q.data.email}
                </p>
                <p className="truncate text-sm text-muted-foreground">{q.data.phone}</p>
              </div>
            </div>

            {user?.memberships.length ? (
              <Link
                to="/manage"
                className="flex items-center gap-4 rounded-md border border-hairline bg-surface-soft p-5 transition-shadow hover:shadow-float"
              >
                <Store className="size-5 shrink-0 text-rausch" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="type-title-md text-ink">Shop workspace</p>
                  <p className="text-sm text-muted-foreground">
                    Manage appointments, customers and staff for your {user.memberships.length} shop
                    {user.memberships.length > 1 ? "s" : ""}.
                  </p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            ) : null}

            <Link
              to="/history"
              className="flex items-center gap-4 rounded-md border border-hairline bg-card p-5 transition-shadow hover:shadow-float"
            >
              <Clock3 className="size-5 shrink-0 text-ink" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="type-title-md text-ink">Your visit history</p>
                <p className="text-sm text-muted-foreground">Across every shop you've been to.</p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>

            <section>
              <h2 className="type-display-md text-ink">Contact details</h2>
              <div className="mt-4 rounded-md border border-hairline bg-card p-6">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className="type-display-md text-ink">Saved preferences</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Shared with a shop only when you book with them.
              </p>
              <Textarea
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                placeholder="e.g. Number 2 on the sides, scissors on top"
                className="mt-4"
              />
            </section>

            <section>
              <h2 className="type-display-md text-ink">Saved style photos</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                These stay on your profile and can be reused for any booking. A reference photo
                added during booking belongs to that appointment only.
              </p>
              <div className="mt-4">
                <ReferencePhotoUploader
                  photos={photos}
                  onChange={setPhotos}
                  max={6}
                  withCaptions
                  emptyHint="Add a photo of a cut you like so you don't have to explain it every time."
                />
              </div>
            </section>

            <section>
              <h2 className="type-display-md text-ink">Privacy</h2>
              <div className="mt-4 space-y-5 rounded-md border border-hairline bg-card p-6">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden />
                  <p className="text-sm text-muted-foreground">
                    Shops can only see their own history with you — never your visits to other
                    shops. Finished haircut photos are never made public.
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="share" className="font-normal">
                    Share my saved preferences with shops I book
                  </Label>
                  <Switch id="share" checked={shareHistory} onCheckedChange={setShareHistory} />
                </div>
              </div>
            </section>

            <div className="flex flex-col gap-3 border-t border-hairline pt-8 sm:flex-row">
              <Button
                className="w-full sm:w-auto"
                disabled={save.isPending}
                onClick={() => save.mutate()}
              >
                {save.isPending ? "Saving…" : "Save changes"}
              </Button>
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => {
                  logout();
                  toast.success("Logged out");
                  void navigate({ to: "/" });
                }}
              >
                <LogOut className="size-4" aria-hidden /> Log out
              </Button>
            </div>
          </div>
        )}
      </div>
    </CustomerShell>
  );
}
