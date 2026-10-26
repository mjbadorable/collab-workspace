"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

type Mode = "signin" | "signup";

const fieldClass =
  "w-full rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

const tabs: { value: Mode; label: string }[] = [
  { value: "signin", label: "Sign In" },
  { value: "signup", label: "Create Account" },
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

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
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
                <input id="auth-email" name="email" type="email" required autoComplete="email" className={fieldClass} />
              </div>
              <div>
                <label htmlFor="auth-password" className="mb-1 block text-xs font-medium text-neutral-600">
                  Password
                </label>
                <input
                  id="auth-password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  className={fieldClass}
                />
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
                {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>
          </>
        )}

        <Link href="/" className="mt-5 block text-center text-sm text-neutral-500 hover:text-neutral-900">
          Continue with local preview
        </Link>
      </div>
    </div>
  );
}
