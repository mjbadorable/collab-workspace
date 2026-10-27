"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Boxes, Hexagon, Lock, Mail, Palette, ShieldCheck, SquareCheckBig, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

type Mode = "signin" | "signup";

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white py-2 pl-9 pr-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

const iconClass = "pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400";

const tabs: { value: Mode; label: string }[] = [
  { value: "signin", label: "Sign In" },
  { value: "signup", label: "Create Account" },
];

const features: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: SquareCheckBig,
    title: "Linear-Style Issue Tracking",
    body: "High-density tickets, global C shortcut, and instant cloud sync.",
  },
  {
    icon: Boxes,
    title: "Interactive Architecture & ERDs",
    body: "React Flow visual engine with editable table schemas and connector lines.",
  },
  {
    icon: Palette,
    title: "Auto-Layout UI Mockups",
    body: "In-browser CSS flexbox canvas with tasks directly linked to components.",
  },
  {
    icon: ShieldCheck,
    title: "Production-Grade Security",
    body: "PostgreSQL Row-Level Security (RLS) and real-time multiplayer WebSockets.",
  },
];

export default function LoginForm() {
  const router = useRouter();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Covers both a fresh sign-in and visiting /login while already signed in.
  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase) return;
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "").trim();
    const password = String(f.get("password") ?? "");
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) setError(error.message);
        // With email confirmation on, signUp succeeds but returns no session until the link is clicked.
        else if (!data.session) setNotice("Check your email for a confirmation link, then sign in.");
      }
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const busyLabel = mode === "signin" ? "Signing in…" : "Creating account…";

  return (
    // Fixed so the landing page covers the app shell (sidebar) and fills the screen.
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
      <div className="grid min-h-full lg:grid-cols-2">
        <aside className="hidden flex-col justify-between bg-neutral-950 p-12 text-white lg:flex">
          <div>
            <div className="flex items-center gap-2.5">
              <Hexagon className="h-7 w-7 text-indigo-400" aria-hidden />
              <span className="text-lg font-semibold">DevOps Collab Workspace</span>
            </div>
            <h2 className="mt-16 max-w-lg text-4xl font-semibold leading-tight">
              The central engineering hub for agile software teams.
            </h2>
            <p className="mt-4 max-w-lg text-neutral-400">
              Plan sprints, map system architectures with interactive flowcharts, design UI mockups, and track
              production deliverables — all in one unified cloud workspace.
            </p>
            <ul className="mt-10 grid max-w-xl gap-3 sm:grid-cols-2">
              {features.map(({ icon: Icon, title, body }) => (
                <li key={title} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
                  <Icon className="h-5 w-5 text-indigo-400" aria-hidden />
                  <h3 className="mt-3 text-sm font-medium">{title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-400">{body}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-10 inline-flex w-fit items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
            All Systems Operational
            <span aria-hidden>·</span>
            v1.0 Production
            <span aria-hidden>·</span>
            Vercel + Supabase
          </div>
        </aside>

        <main className="flex flex-col items-center justify-center bg-neutral-50 px-4 py-10">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <Hexagon className="h-6 w-6 text-indigo-600" aria-hidden />
            <span className="font-semibold">DevOps Collab Workspace</span>
          </div>
          <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h1 className="text-lg font-semibold">Welcome to Collab Workspace</h1>
            <p className="mt-1 text-sm text-neutral-500">Sign in to sync your workspace, or continue in local preview.</p>

            {!supabase ? (
              <p role="alert" className="mt-5 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Supabase isn&apos;t configured. Set <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
                <code className="font-mono">.env.local</code> and restart the dev server.
              </p>
            ) : (
              <>
                <div role="tablist" aria-label="Authentication" className="mt-5 flex rounded-md bg-neutral-100 p-0.5">
                  {tabs.map((t) => (
                    <button
                      key={t.value}
                      role="tab"
                      type="button"
                      aria-selected={mode === t.value}
                      onClick={() => switchMode(t.value)}
                      className={`flex-1 rounded px-2 py-1.5 text-sm ${
                        mode === t.value ? "bg-white font-medium shadow-sm" : "text-neutral-600 hover:text-neutral-900"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={submit} className="mt-5 space-y-4">
                  <div>
                    <label htmlFor="auth-email" className="mb-1 block text-xs font-medium text-neutral-600">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className={iconClass} aria-hidden />
                      <input id="auth-email" name="email" type="email" required autoComplete="email" className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="auth-password" className="mb-1 block text-xs font-medium text-neutral-600">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className={iconClass} aria-hidden />
                      <input
                        id="auth-password"
                        name="password"
                        type="password"
                        required
                        minLength={6}
                        autoComplete={mode === "signin" ? "current-password" : "new-password"}
                        className={inputClass}
                      />
                    </div>
                    {mode === "signup" && <p className="mt-1 text-xs text-neutral-500">At least 6 characters.</p>}
                  </div>
                  {error && (
                    <p role="alert" className="rounded-md bg-red-50 px-2.5 py-1.5 text-sm text-red-700">
                      {error}
                    </p>
                  )}
                  {notice && (
                    <p role="status" className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-sm text-emerald-800">
                      {notice}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {busy ? busyLabel : mode === "signin" ? "Sign in" : "Create account"}
                  </button>
                </form>
              </>
            )}

            <Link href="/" className="mt-5 block text-center text-sm text-neutral-500 hover:text-neutral-900">
              Continue with local preview
            </Link>
          </div>
          <p className="mt-6 flex items-center gap-1.5 text-center text-xs text-neutral-500">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Protected by PostgreSQL Row-Level Security &amp; Encrypted JWT Auth
          </p>
        </main>
      </div>
    </div>
  );
}
