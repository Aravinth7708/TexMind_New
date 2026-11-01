import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Factory, Loader2, ShieldCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { TexMindLogo, TexMindMark } from "@/components/brand/logo";
import { homeFor, saveSession, type Session } from "@/lib/session";
import { STAGES, type StageKey } from "@/lib/data";
import { API_BASE_URL } from "@/lib/order-costing";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — TexMind Factory Intelligence" },
      {
        name: "description",
        content: "Sign in to TexMind to monitor garment production from yarn to packing in real time.",
      },
      { property: "og:title", content: "Sign in — TexMind Factory Intelligence" },
      {
        property: "og:description",
        content: "Access your garment factory production command centre.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function signIn(nextEmail: string, nextPassword: string, key: string) {
    setLoading(key);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: nextEmail, password: nextPassword }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Invalid email or password.");
      const user = result.user;
      const role = user.role === "buyer" ? "buyer" : user.role === "process" ? "process" : "admin";
      const session: Session = role === "process" && STAGES.includes(user.stage as StageKey)
        ? { role, stage: user.stage as StageKey, email: user.email, name: user.name, title: user.title || "Process Portal" }
        : role === "buyer"
          ? { role, email: user.email, name: user.name, title: user.title || "Buyer Portal" }
          : { role: "admin", email: user.email, name: user.name, title: user.title || "Factory Manager" };
      saveSession(session);
      setTimeout(() => navigate({ to: homeFor(session) as never }), 250);
    } catch (cause) {
      setError(cause instanceof Error && cause.message !== "Failed to fetch"
        ? cause.message
        : "Could not connect to the portal server. Please try again.");
      setLoading(null);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div className="grid-lines absolute inset-0 opacity-[0.08]" />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <TexMindMark className="size-10" />
            <div>
              <div className="font-display text-lg font-semibold">TexMind</div>
              <div className="text-[11px] uppercase tracking-[0.16em] opacity-70">
                AI Factory Intelligence
              </div>
            </div>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="font-display text-[34px] leading-[1.15] font-semibold">
            AI-powered intelligence for modern garment manufacturing.
          </h2>
          <p className="mt-4 text-sm leading-relaxed opacity-80">
            Every order, every stage — yarn to packing — monitored in one control centre built for
            Tiruppur factories.
          </p>
          <ul className="mt-8 space-y-3.5 text-[13px]">
            {[
              { icon: Factory, text: "9 separate process portals" },
              { icon: TrendingUp, text: "Bottleneck and delay prediction" },
              { icon: ShieldCheck, text: "Buyer portal with controlled visibility" },
            ].map((f) => (
              <li key={f.text} className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-white/10">
                  <f.icon className="size-4" />
                </span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative grid grid-cols-3 gap-4 border-t border-white/15 pt-6 text-center">
          {[
            ["9", "Production stages"],
            ["Live", "Order tracking"],
            ["One", "Factory workspace"],
          ].map(([v, l]) => (
            <div key={l}>
              <div className="metric text-lg font-semibold">{v}</div>
              <div className="text-[11px] opacity-70">{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-start justify-center overflow-y-auto px-4 py-10 sm:px-5 sm:py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden">
            <TexMindLogo />
          </div>
          <h1 className="mt-8 text-2xl font-semibold lg:mt-0">Sign in</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Factory, process team or buyer — use your portal credentials.
          </p>

          <form
            className="mt-7 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              signIn(email, password, "email");
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10"
              />
            </div>
            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
                {error}
              </p>
            )}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Checkbox defaultChecked /> Remember me
              </label>
              <button type="button" className="text-[13px] font-medium text-primary hover:underline">
                Forgot password?
              </button>
            </div>
            <Button type="submit" className="h-10 w-full" disabled={loading === "email"}>
              {loading === "email" ? <Loader2 className="size-4 animate-spin" /> : "Login"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">Sign in with an account configured for your factory.</p>
        </div>
      </div>
    </div>
  );
}

