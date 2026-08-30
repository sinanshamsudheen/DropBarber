import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Wordmark } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getErrorMessage } from "@/lib/api-client";
import { useSession } from "@/lib/session";

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
  const [password, setPassword] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [reset, setReset] = useState(false);

  const finish = () => {
    if (redirect) window.location.href = redirect;
    else void navigate({ to: "/" });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name.split(" ")[0] || user.email}`);
      finish();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !signupPassword) {
      setError("Please add your name, email and password.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      await signup(name, email, signupPassword);
      toast.success("Account created");
      finish();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPending(false);
    }
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
                toast.info("Password reset isn't available yet.");
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
                      required
                      className="mt-2"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
                  <div>
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      required
                      className="mt-2"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
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
