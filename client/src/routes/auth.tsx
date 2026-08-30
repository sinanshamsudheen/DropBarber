import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Scissors } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEMO_USERS, useSession } from "@/lib/session";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search["redirect"] === "string" ? { redirect: search["redirect"] } : {},
  head: () => ({
    meta: [
      { title: "Log in or sign up — Drop" },
      { name: "description", content: "Access your bookings, history and shop workspace on Drop." },
      { property: "og:title", content: "Log in or sign up — Drop" },
      { property: "og:description", content: "Access your bookings, history and shop workspace." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { login, signup } = useSession();
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [reset, setReset] = useState(false);

  const finish = () => {
    if (redirect) window.location.href = redirect;
    else void navigate({ to: "/" });
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    setTimeout(() => {
      const user = login(email);
      setPending(false);
      if (!user) {
        setError("We don't recognise that email. Try one of the demo accounts below.");
        return;
      }
      toast.success(`Welcome back, ${user.name.split(" ")[0]}`);
      finish();
    }, 500);
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Please add your name and email.");
      return;
    }
    setPending(true);
    setTimeout(() => {
      signup(name, email);
      setPending(false);
      toast.success("Account created");
      finish();
    }, 600);
  };

  return (
    <div className="min-h-screen bg-surface">
      <div className="page py-6">
        <Button variant="ghost" size="sm" onClick={() => void navigate({ to: "/" })} className="-ml-2">
          <ArrowLeft className="size-4" aria-hidden /> Back
        </Button>

        <div className="mx-auto mt-6 max-w-md">
          <div className="mb-6 text-center">
            <span className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Scissors className="size-5" aria-hidden />
            </span>
            <h1 className="text-2xl font-semibold">Drop</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Book barbers nearby, or manage your shop — one account.
            </p>
          </div>

          <Card>
            <CardContent className="pt-6">
              {reset ? (
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    toast.success("If that email exists, a reset link is on its way.");
                    setReset(false);
                  }}
                >
                  <div>
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      required
                      className="mt-1.5 h-11"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="h-11 w-full">
                    Send reset link
                  </Button>
                  <Button type="button" variant="ghost" className="w-full" onClick={() => setReset(false)}>
                    Back to log in
                  </Button>
                </form>
              ) : (
                <Tabs defaultValue="login">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="login">Log in</TabsTrigger>
                    <TabsTrigger value="signup">Sign up</TabsTrigger>
                  </TabsList>

                  <TabsContent value="login">
                    <form className="space-y-4" onSubmit={handleLogin}>
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          required
                          className="mt-1.5 h-11"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          aria-describedby={error ? "auth-error" : undefined}
                        />
                      </div>
                      <div>
                        <Label htmlFor="password">Password</Label>
                        <Input id="password" type="password" className="mt-1.5 h-11" placeholder="Any value in demo" />
                      </div>
                      {error && (
                        <p id="auth-error" role="alert" className="text-sm text-destructive">
                          {error}
                        </p>
                      )}
                      <Button type="submit" className="h-11 w-full" disabled={pending}>
                        {pending ? "Logging in…" : "Log in"}
                      </Button>
                      <button
                        type="button"
                        className="w-full text-center text-sm text-muted-foreground underline-offset-2 hover:underline"
                        onClick={() => setReset(true)}
                      >
                        Forgot password?
                      </button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup">
                    <form className="space-y-4" onSubmit={handleSignup}>
                      <div>
                        <Label htmlFor="name">Full name</Label>
                        <Input
                          id="name"
                          className="mt-1.5 h-11"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="signup-email">Email</Label>
                        <Input
                          id="signup-email"
                          type="email"
                          className="mt-1.5 h-11"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                      {error && (
                        <p role="alert" className="text-sm text-destructive">
                          {error}
                        </p>
                      )}
                      <Button type="submit" className="h-11 w-full" disabled={pending}>
                        {pending ? "Creating account…" : "Create account"}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>

          <div className="mt-5 rounded-2xl border border-dashed border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Demo accounts</p>
            <ul className="mt-2 space-y-1.5">
              {Object.entries(DEMO_USERS).map(([mail, u]) => (
                <li key={mail}>
                  <button
                    type="button"
                    onClick={() => setEmail(mail)}
                    className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-secondary"
                  >
                    <span className="font-medium">{u.name}</span>{" "}
                    <span className="text-muted-foreground">
                      · {u.memberships.length ? u.memberships[0]?.role : "customer"} · {mail}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
