import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Wordmark } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
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
      {
        name: "description",
        content: "Access your bookings, history and shop workspace on Drop.",
      },
      { property: "og:title", content: "Log in or sign up — Drop" },
      {
        property: "og:description",
        content: "Access your bookings, history and shop workspace.",
      },
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
    <div className="min-h-screen bg-background">
      <header className="border-b border-hairline">
        <div className="page flex h-20 items-center justify-between gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void navigate({ to: "/" })}
            className="-ml-4 rounded-full"
          >
            <ArrowLeft className="size-4" aria-hidden /> Back
          </Button>
          <Wordmark />
        </div>
      </header>

      <div className="page-form py-10 sm:py-12">
        <h1 className="type-display-xl text-ink">Log in or sign up</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Book barbers nearby, or manage your shop — one account.
        </p>

        <div className="mt-8">
          {reset ? (
            <form
              className="space-y-5"
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
                  className="mt-2"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full">
                Send reset link
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setReset(false)}
              >
                Back to log in
              </Button>
            </form>
          ) : (
            <Tabs defaultValue="login">
              <TabsList>
                <TabsTrigger value="login">Log in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form className="space-y-5" onSubmit={handleLogin}>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      className="mt-2"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? "auth-error" : undefined}
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      className="mt-2"
                      placeholder="Any value in demo"
                    />
                  </div>
                  {error && (
                    <p id="auth-error" role="alert" className="text-sm text-destructive">
                      {error}
                    </p>
                  )}
                  <Button type="submit" className="w-full" disabled={pending}>
                    {pending ? "Logging in…" : "Log in"}
                  </Button>
                  <Button
                    type="button"
                    variant="link"
                    className="w-full"
                    onClick={() => setReset(true)}
                  >
                    Forgot password?
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form className="space-y-5" onSubmit={handleSignup}>
                  <div>
                    <Label htmlFor="name">Full name</Label>
                    <Input
                      id="name"
                      className="mt-2"
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
                      className="mt-2"
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
                  <Button type="submit" className="w-full" disabled={pending}>
                    {pending ? "Creating account…" : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </div>

        <div className="mt-8 rounded-md border border-dashed border-hairline p-5">
          <p className="text-sm font-medium text-ink">Demo accounts</p>
          <ul className="mt-3 space-y-2">
            {Object.entries(DEMO_USERS).map(([mail, u]) => (
              <li key={mail}>
                <button
                  type="button"
                  onClick={() => setEmail(mail)}
                  className="w-full rounded-sm px-3 py-3 text-left text-sm transition-colors hover:bg-surface-soft"
                >
                  <span className="font-medium text-ink">{u.name}</span>{" "}
                  <span className="text-muted-foreground">
                    · {u.memberships.length ? u.memberships[0]?.role : "customer"} · {mail}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-8 text-[13px] text-muted-foreground">
          By continuing you agree to Drop's{" "}
          <a href="/" className="text-legal-link underline-offset-2 hover:underline">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/" className="text-legal-link underline-offset-2 hover:underline">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}
