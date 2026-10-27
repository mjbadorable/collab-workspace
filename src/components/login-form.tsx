"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Boxes,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Palette,
  ShieldCheck,
  SquareCheckBig,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import PokeballIcon from "./pokeball-icon";

type Mode = "signin" | "signup";

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white py-2 pl-9 pr-2.5 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500";

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

function evaluatePassword(pwd: string) {
  const hasMinLength = pwd.length >= 8;
  const hasUpperLower = /[a-z]/.test(pwd) && /[A-Z]/.test(pwd);
  const hasNumber = /\d/.test(pwd);
  const hasSymbol = /[^A-Za-z0-9]/.test(pwd);
  const score = [hasMinLength, hasUpperLower, hasNumber, hasSymbol].filter(Boolean).length;
  return { hasMinLength, hasUpperLower, hasNumber, hasSymbol, score };
}

const strengthMeta = [
  { label: "Too weak", bar: "bg-neutral-200", text: "text-neutral-500" },
  { label: "Weak", bar: "bg-red-500", text: "text-red-600" },
  { label: "Fair", bar: "bg-amber-500", text: "text-amber-600" },
  { label: "Good", bar: "bg-lime-500", text: "text-lime-600" },
  { label: "Strong", bar: "bg-emerald-500", text: "text-emerald-600" },
];

function PasswordInput({
  id,
  name,
  value,
  onChange,
  shown,
  onToggle,
  autoComplete,
  invalid,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (next: string) => void;
  shown: boolean;
  onToggle: () => void;
  autoComplete: string;
  invalid?: boolean;
}) {
  const ToggleIcon = shown ? EyeOff : Eye;
  return (
    <div className="relative">
      <Lock className={iconClass} aria-hidden />
      <input
        id={id}
        name={name}
        type={shown ? "text" : "password"}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-invalid={invalid || undefined}
        className={`${inputClass} pr-10`}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-400 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
      >
        <ToggleIcon className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

function PasswordChecklist({ password }: { password: string }) {
  const r = evaluatePassword(password);
  const meta = strengthMeta[password ? r.score : 0];
  const rules = [
    { ok: r.hasMinLength, label: "Must have at least 8 characters" },
    { ok: r.hasUpperLower, label: "Upper & lower case letters" },
    { ok: r.hasNumber, label: "A number" },
    { ok: r.hasSymbol, label: "A symbol (@$!%*?&#)" },
  ];
  return (
    <div className="mt-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <div className="flex gap-1" role="img" aria-label={`Password strength: ${meta.label}`}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${i < r.score ? meta.bar : "bg-neutral-200"}`}
          />
        ))}
      </div>
      <p className={`mt-1.5 text-xs font-medium ${meta.text}`} aria-live="polite">
        {meta.label}
      </p>
      <ul className="mt-2 space-y-1">
        {rules.map(({ ok, label }) => (
          <li key={label} className={`flex items-center gap-2 text-xs ${ok ? "text-emerald-700" : "text-neutral-500"}`}>
            {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> : <Circle className="h-3.5 w-3.5 text-neutral-300" aria-hidden />}
            {label}
            <span className="sr-only">{ok ? "(met)" : "(not met)"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LoginForm() {
  const router = useRouter();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Doors: they start apart on mount and slide shut, then slide apart again after a successful sign-in.
  const [closed, setClosed] = useState(false);
  const [opening, setOpening] = useState(false);
  const doorsApart = !closed || opening;
  // Set while a submit is in flight so the redirect below doesn't cut the door animation short.
  const submitting = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setClosed(true));
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer.current);
    };
  }, []);

  // Covers visiting /login while already signed in; a fresh sign-in is redirected by openDoors.
  useEffect(() => {
    if (user && !submitting.current) router.replace("/");
  }, [user, router]);

  const openDoors = () => {
    setOpening(true);
    timer.current = setTimeout(() => router.replace("/"), 1000);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setConfirmPassword("");
    setError(null);
    setNotice(null);
  };

  const mismatch = confirmPassword !== "" && password !== confirmPassword;
  const signupReady = evaluatePassword(password).score === 4 && password === confirmPassword;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase) return;
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "").trim();
    if (mode === "signup" && !signupReady) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    submitting.current = true;
    let entered = false;
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
        else entered = true;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) setError(error.message);
        // With email confirmation on, signUp succeeds but returns no session until the link is clicked.
        else if (!data.session) setNotice("Check your email for a confirmation link, then sign in.");
        else entered = true;
      }
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
      if (entered) openDoors();
      else submitting.current = false;
    }
  };

  const busyLabel = mode === "signin" ? "Signing in…" : "Creating account…";

  return (
    // The wrapper's dark backdrop and badge are what the doors reveal when they open.
    <div className="relative overflow-hidden bg-neutral-950">
      <div
        aria-live="polite"
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-700 ${
          opening ? "opacity-100" : "opacity-0"
        }`}
      >
        {opening && (
          <span className="flex animate-pulse items-center gap-2 rounded-full border border-amber-400/60 bg-neutral-900 px-4 py-2 text-sm text-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.45)]">
            <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
            Wild Workspace Appeared! · Access Granted
          </span>
        )}
      </div>

      {/* Bottom (white) half of the Pokéball. It sits above the left door, so it is its own layer that slides with the right door. */}
      <span
        className={`pointer-events-none absolute left-1/2 top-1/2 z-20 hidden h-[50px] w-[100px] rounded-b-full border-4 border-t-0 border-neutral-900 bg-white transition-transform duration-700 ease-in-out motion-reduce:transition-none lg:block ${
          doorsApart ? "translate-x-[calc(50vw-50%)]" : "-translate-x-1/2"
        }`}
        aria-hidden
      />

      {/* Release button on the seam between the doors (desktop only). It flashes, then fades as the doors split. */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 hidden -translate-x-1/2 -translate-y-1/2 lg:block">
        <span
          className={`relative flex h-8 w-8 items-center justify-center rounded-full border-4 border-neutral-900 bg-white shadow-md transition-all duration-700 ease-out motion-reduce:transition-none ${
            opening ? "scale-150 bg-amber-200 opacity-0 ring-8 ring-amber-300/70" : "ring-4 ring-red-400/50"
          }`}
        >
          <span className="absolute h-3 w-3 animate-ping rounded-full bg-red-400/70 motion-reduce:animate-none" aria-hidden />
          <span className={`relative h-3 w-3 rounded-full ${opening ? "bg-amber-400" : "bg-red-500"}`} aria-hidden />
        </span>
      </div>

      <div className="grid min-h-screen lg:grid-cols-2">
        <aside
          className={`relative z-10 hidden flex-col justify-between bg-neutral-950 p-12 text-white transition-transform duration-700 ease-in-out motion-reduce:transition-none lg:flex lg:pr-16 ${
            doorsApart ? "-translate-x-full opacity-90" : "translate-x-0"
          }`}
        >
          {/* Top (red) half of the Pokéball rides on the left door. */}
          <span
            className="pointer-events-none absolute right-0 top-1/2 h-[50px] w-[100px] translate-x-1/2 -translate-y-full rounded-t-full border-4 border-b-8 border-neutral-900 bg-red-600"
            aria-hidden
          />
          <div>
            <div className="flex items-center gap-2.5">
              <PokeballIcon className="h-7 w-7" />
              <span className="text-lg font-semibold">Silph DevOps · Collaborative Engineering Portal</span>
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
                  <Icon className="h-5 w-5 text-amber-400" aria-hidden />
                  <h3 className="mt-3 text-sm font-medium">{title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-400">{body}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-10 inline-flex w-fit items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" aria-hidden />
            ⚡ Pokémon League Mainnet · Operational
            <span aria-hidden>·</span>
            v1.0 Production
            <span aria-hidden>·</span>
            Vercel + Supabase
          </div>
        </aside>

        <main
          className={`relative flex flex-col items-center justify-center bg-neutral-50 px-4 py-10 transition-all duration-700 ease-in-out motion-reduce:transition-none ${
            doorsApart ? "opacity-0 max-lg:scale-95 lg:translate-x-full lg:opacity-90" : "translate-x-0 opacity-100"
          }`}
        >
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <PokeballIcon className="h-6 w-6" />
            <span className="font-semibold">Silph DevOps Portal</span>
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
                    <PasswordInput
                      id="auth-password"
                      name="password"
                      value={password}
                      onChange={setPassword}
                      shown={showPassword}
                      onToggle={() => setShowPassword((s) => !s)}
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    />
                    {mode === "signup" && <PasswordChecklist password={password} />}
                  </div>
                  {mode === "signup" && (
                    <div>
                      <label htmlFor="auth-confirm" className="mb-1 block text-xs font-medium text-neutral-600">
                        Confirm password
                      </label>
                      <PasswordInput
                        id="auth-confirm"
                        name="confirm"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        shown={showConfirmPassword}
                        onToggle={() => setShowConfirmPassword((s) => !s)}
                        autoComplete="new-password"
                        invalid={mismatch}
                      />
                      {mismatch && (
                        <p role="alert" className="mt-1 text-xs text-red-600">
                          Passwords don&apos;t match.
                        </p>
                      )}
                    </div>
                  )}
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
                    disabled={busy || opening || (mode === "signup" && !signupReady)}
                    className="w-full rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
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
