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
      { name: "description", content: "Manage your details, saved style photos and privacy settings." },
      { property: "og:title", content: "Your profile — Drop" },
      { property: "og:description", content: "Your details, saved style photos and privacy controls." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, ready, logout } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ["profile"], queryFn: () => getCustomerProfile(), enabled: !!user });

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
    mutationFn: () => saveCustomerProfile(CURRENT_CUSTOMER_ID, { preferences, phone, savedPhotos: photos }),
    onSuccess: () => {
      toast.success("Profile saved");
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (ready && !user) {
    return (
      <CustomerShell>
        <div className="page">
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
      <div className="page">
        <PageHeader title="Profile" />

        {q.isPending && <ListSkeleton rows={3} />}

        {q.data && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
              <Avatar className="size-16">
                <AvatarFallback className="bg-secondary font-display text-lg">
                  {initials(user?.name ?? q.data.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{user?.name ?? q.data.name}</p>
                <p className="truncate text-sm text-muted-foreground">{user?.email ?? q.data.email}</p>
                <p className="truncate text-sm text-muted-foreground">{q.data.phone}</p>
              </div>
            </div>

            {user?.memberships.length ? (
              <Link
                to="/manage"
                className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/8 p-4"
              >
                <Store className="size-5 shrink-0 text-accent" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Shop workspace</p>
                  <p className="text-xs text-muted-foreground">
                    Manage appointments, customers and staff for your {user.memberships.length} shop
                    {user.memberships.length > 1 ? "s" : ""}.
                  </p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            ) : null}

            <Link to="/history" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <Clock3 className="size-5 shrink-0 text-accent" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Your visit history</p>
                <p className="text-xs text-muted-foreground">Across every shop you've been to.</p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>

            <section>
              <h2 className="text-base font-semibold">Contact details</h2>
              <div className="mt-3 space-y-3 rounded-2xl border border-border bg-card p-4">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1.5 h-11"
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-base font-semibold">Saved preferences</h2>
              <p className="text-xs text-muted-foreground">
                Shared with a shop only when you book with them.
              </p>
              <Textarea
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                placeholder="e.g. Number 2 on the sides, scissors on top"
                className="mt-3 min-h-24"
              />
            </section>

            <section>
              <h2 className="text-base font-semibold">Saved style photos</h2>
              <p className="text-xs text-muted-foreground">
                These stay on your profile and can be reused for any booking. A reference photo added during
                booking belongs to that appointment only.
              </p>
              <div className="mt-3">
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
              <h2 className="text-base font-semibold">Privacy</h2>
              <div className="mt-3 space-y-3 rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  <p className="text-xs text-muted-foreground">
                    Shops can only see their own history with you — never your visits to other shops. Finished
                    haircut photos are never made public.
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="share" className="text-sm font-normal">
                    Share my saved preferences with shops I book
                  </Label>
                  <Switch id="share" checked={shareHistory} onCheckedChange={setShareHistory} />
                </div>
              </div>
            </section>

            <div className="space-y-2 pb-4">
              <Button
                size="lg"
                className="h-12 w-full rounded-xl"
                disabled={save.isPending}
                onClick={() => save.mutate()}
              >
                {save.isPending ? "Saving…" : "Save changes"}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-12 w-full rounded-xl"
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
