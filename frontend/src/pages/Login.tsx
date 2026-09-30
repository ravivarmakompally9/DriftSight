import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Loader2, Radar, Ship, Waves } from "lucide-react";
import { toast } from "sonner";

import { LogoMark, Wordmark } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError, tokenStore } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import type { DemoAccount } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";

const POINTS = [
  { icon: Radar, title: "Detect once", body: "A per-pixel classifier flags suspected plastic in every clear satellite pass." },
  { icon: Waves, title: "Track always", body: "Each detection seeds virtual particles that drift with the currents and the wind." },
  { icon: Ship, title: "Act early", body: "Confirmed patches and forecast pellet landfall become clean-up missions." },
];

export default function Login() {
  const navigate = useNavigate();
  const setUser = useAppStore((s) => s.setUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: accounts } = useQuery({ queryKey: ["demo-accounts"], queryFn: api.demoAccounts, staleTime: Infinity });

  async function signIn(e: string, p: string) {
    setBusy(true);
    try {
      const res = await api.login(e, p);
      tokenStore.set(res.access_token);
      setUser(res.user);
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      {/* left: the pitch */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-navy p-10 text-onnavy lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "radial-gradient(60rem 40rem at 20% 10%, #5AD6D6 0%, transparent 60%), radial-gradient(50rem 35rem at 90% 80%, #3F6FB5 0%, transparent 60%)",
          }}
          aria-hidden
        />
        <div className="relative flex items-center gap-3">
          <LogoMark size={34} />
          <Wordmark className="text-[26px]" />
        </div>

        <div className="relative max-w-md">
          <h2 className="font-display text-[34px] font-extrabold leading-tight text-white">
            Plastic you can see from orbit. Pellets you cannot.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-onnavy-2">
            DriftSight follows the debris from the MSC ELSA 3 sinking off Kerala on 25 May 2025 — and
            forecasts where the nurdles come ashore, days before anyone finds them.
          </p>
          <div className="mt-7 grid gap-4">
            {POINTS.map((p) => (
              <div key={p.title} className="flex gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-[#5AD6D6]">
                  <p.icon size={16} />
                </span>
                <div>
                  <div className="text-[14px] font-semibold text-white">{p.title}</div>
                  <div className="text-[13px] leading-snug text-onnavy-2">{p.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative flex items-start gap-2 text-[12px] text-onnavy-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Prototype. Satellite imagery and ocean fields are simulated — nothing shown is a measurement.
        </p>
      </div>

      {/* right: the form */}
      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-7 flex items-center gap-2.5 lg:hidden">
            <LogoMark />
            <span className="font-display text-[23px] font-extrabold leading-none text-ink">
              Drift<span className="text-brand">Sight</span>
            </span>
          </div>

          <h1 className="text-[24px] font-bold">Sign in</h1>
          <p className="mt-1 text-[13.5px] text-ink-2">
            Marine debris console · MSC ELSA 3 · Kerala
          </p>

          <form
            className="mt-6 grid gap-3.5"
            onSubmit={(e) => { e.preventDefault(); signIn(email, password); }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email" type="email" autoComplete="username" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="analyst@incois.demo"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password" type="password" autoComplete="current-password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="demo123"
              />
            </div>
            <Button type="submit" variant="default" size="lg" disabled={busy} className="mt-1">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              Sign in
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-[11.5px] uppercase tracking-wider text-ink-3">
            <span className="h-px flex-1 bg-line" />
            or use a demo account
            <span className="h-px flex-1 bg-line" />
          </div>

          <div className="grid gap-2">
            {(accounts ?? []).map((a: DemoAccount) => (
              <button
                key={a.email}
                onClick={() => signIn(a.email, a.password)}
                disabled={busy}
                className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:bg-surface-2 disabled:opacity-60"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft font-display text-[13px] font-bold text-brand">
                  {a.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold">{a.name}</span>
                  <span className="block truncate font-mono text-[11.5px] text-ink-3">{a.email}</span>
                </span>
                <ArrowRight size={15} className="shrink-0 text-ink-3" />
              </button>
            ))}
          </div>

          <p className="mt-6 text-[12px] leading-relaxed text-ink-3">
            Both demo accounts use the password <code className="font-mono">demo123</code>. They are published
            credentials for a prototype, not secrets.
          </p>
        </div>
      </div>
    </div>
  );
}
