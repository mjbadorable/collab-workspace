"use client";

import { useState } from "react";
import { DownloadCloud, GitBranch, Loader2 } from "lucide-react";
import { useGitAction, type GitActionResult } from "@/lib/use-git-action";

export function ResultPill({ result }: { result: GitActionResult | null }) {
  if (!result) return null;
  return (
    <span
      role="status"
      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {result.message}
    </span>
  );
}

// One-click `git push origin <branch>` for a fleet project. Only render where the local API exists.
export function PushNowButton({ projectId, label = "🚀 Push to Origin Now", className = "" }: { projectId: string; label?: string; className?: string }) {
  const { running, result, pushToOrigin } = useGitAction(projectId);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void pushToOrigin()}
        disabled={running}
        className={`flex shrink-0 items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white shadow-xs hover:bg-red-700 disabled:opacity-60 ${className}`}
      >
        {running && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
        {running ? "Pushing…" : label}
      </button>
      <ResultPill result={result} />
    </span>
  );
}

// Project overview header: a small popover with Push and Fetch. The API refuses non-localhost hosts anyway,
// so the button is simply not shown on a deployed build.
export function GitActionMenu({ projectId, className }: { projectId: string; className: string }) {
  const { running, result, pushToOrigin, fetchOrigin } = useGitAction(projectId);
  const [open, setOpen] = useState(false);
  const hostname = window.location.hostname;
  if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname) && !hostname.endsWith(".localhost")) return null;

  const item = "flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50";
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true" className={className}>
        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <GitBranch className="h-3.5 w-3.5" aria-hidden />} Git: Push / Fetch
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg">
          <button type="button" disabled={running} onClick={() => void pushToOrigin()} className={item}>
            <span aria-hidden>🚀</span> Push to origin
          </button>
          <button type="button" disabled={running} onClick={() => void fetchOrigin()} className={item}>
            <DownloadCloud className="h-3.5 w-3.5" aria-hidden /> Fetch origin
          </button>
          {result && (
            <p role="status" className={`mt-1 border-t border-neutral-100 px-2 pt-1.5 text-[11px] ${result.ok ? "text-emerald-700" : "text-red-700"}`}>
              {result.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
