"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { FlaskConical, Rocket } from "lucide-react";
import { useProjects } from "@/lib/projects-context";

export type Environment = "production" | "staging";

const STORAGE_KEY = "collab-workspace:active-environment";
const CHANGE_EVENT = "collab-workspace:environment-change";

const isLocalHostname = (host: string) => host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".localhost");

function readEnvironment(): Environment {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "production" || stored === "staging") return stored;
  } catch {
    // Storage can be blocked; fall through to the default.
  }
  return isLocalHostname(window.location.hostname) ? "staging" : "production";
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// null during server render and hydration, so nothing environment-specific can mismatch.
export function useEnvironment(): [Environment | null, (next: Environment) => void] {
  const env = useSyncExternalStore<Environment | null>(subscribe, readEnvironment, () => null);
  const set = (next: Environment) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Without storage the choice cannot persist, but the event still reaches this tab.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  return [env, set];
}

const OPTIONS: { value: Environment; label: string; Icon: typeof Rocket }[] = [
  { value: "production", label: "Production", Icon: Rocket },
  { value: "staging", label: "Staging", Icon: FlaskConical },
];

const hostOf = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/$/, "");

export default function EnvironmentSwitcher() {
  const [env, setEnv] = useEnvironment();
  const { currentProject } = useProjects();
  const projectId = currentProject?.id ?? "collab-workspace";
  const [branchInfo, setBranchInfo] = useState<{ projectId: string; branch: string } | null>(null);

  // Staging shows the branch checked out on this machine; the API answers { isLocal: false } off-localhost.
  useEffect(() => {
    if (env !== "staging") return;
    let cancelled = false;
    fetch(`/api/local-git-status?project=${encodeURIComponent(projectId)}`)
      .then((r) => r.json() as Promise<{ isLocal?: boolean; notFound?: boolean; branch?: string }>)
      .then((data) => {
        if (!cancelled && data.isLocal && !data.notFound && data.branch) setBranchInfo({ projectId, branch: data.branch });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [env, projectId]);

  // The placeholder keeps the card's size, so the sidebar does not jump once the stored choice is read.
  if (!env) return <div className="h-[5.5rem] rounded-xl border border-white/10 bg-white/[0.05]" aria-hidden />;

  const branch = branchInfo?.projectId === projectId ? branchInfo.branch : null;
  const liveUrl = currentProject?.live_url;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.05] p-2.5 text-neutral-200">
      <div role="radiogroup" aria-label="Environment" className="grid grid-cols-2 gap-0.5 rounded-full border border-white/10 bg-black/30 p-0.5">
        {OPTIONS.map(({ value, label, Icon }) => {
          const active = env === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setEnv(value)}
              className={`flex items-center justify-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                active
                  ? value === "production"
                    ? "border-emerald-500/30 bg-emerald-500/20 font-medium text-emerald-300"
                    : "border-transparent bg-amber-500 font-semibold text-neutral-950"
                  : "border-transparent text-neutral-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 truncate px-1 font-mono text-[11px] text-neutral-400" aria-live="polite">
        {env === "production"
          ? liveUrl
            ? hostOf(liveUrl)
            : "No live URL set"
          : `localhost:3000 · localhost:5173${branch ? ` · ${branch}` : ""}`}
      </p>
      {env === "staging" && (
        <p className="mt-0.5 px-1 text-[11px] leading-snug text-amber-300">
          🧪 Staging Mode Active — Smoke Test Runner available in{" "}
          <Link href={`/projects/${projectId}`} className="font-medium underline-offset-2 hover:underline">
            Project Overview
          </Link>
        </p>
      )}
    </div>
  );
}
