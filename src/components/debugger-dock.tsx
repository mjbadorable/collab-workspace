"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronRight, ClipboardCopy, FlaskConical, Trash2, X } from "lucide-react";
import {
  clearSentinelEvents,
  formatDiagnostic,
  recordSentinelEvent,
  startErrorSentinel,
  useSentinelEvents,
  type SentinelEvent,
} from "@/lib/error-sentinel";
import { useEnvironment } from "./environment-switcher";

const BADGE: Record<SentinelEvent["kind"], { label: string; className: string }> = {
  error: { label: "Error", className: "bg-red-100 text-red-700" },
  rejection: { label: "Promise", className: "bg-orange-100 text-orange-700" },
  network: { label: "Network", className: "bg-amber-100 text-amber-800" },
  diagnostic: { label: "Test", className: "bg-sky-100 text-sky-700" },
};

const timeOf = (ts: number) => new Date(ts).toLocaleTimeString([], { hour12: false });

// Floating system-health pill (bottom-left) plus a slide-over log of captured runtime errors and failed requests.
export default function DebuggerDock() {
  const events = useSentinelEvents();
  const [env] = useEnvironment();
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => startErrorSentinel(), []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const latest = events[0];
  const count = events.length;

  const copyDiagnostic = async () => {
    try {
      await navigator.clipboard.writeText(formatDiagnostic(events, env));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context or denied permission): nothing to confirm.
    }
  };

  return (
    <>
      <div className="no-print fixed bottom-4 left-4 z-30 md:left-[17.5rem]">
        {count === 0 ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="System healthy, open diagnostics"
            className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 shadow-sm hover:bg-emerald-100"
          >
            <span aria-hidden className="text-[10px]">●</span> System Healthy
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`${count} issues, open diagnostics`}
            className="flex max-w-[calc(100vw-2rem)] animate-pulse items-center gap-1.5 rounded-full border border-red-300 bg-amber-50 px-3 py-1 text-xs font-medium text-red-700 shadow-md hover:bg-amber-100"
          >
            <span aria-hidden>⚠</span>
            <span className="shrink-0">{count} {count === 1 ? "Issue" : "Issues"}</span>
            <span className="min-w-0 max-w-56 truncate font-normal text-red-600/80">{latest.message}</span>
          </button>
        )}
      </div>

      {open && (
        <div className="no-print fixed inset-0 z-50 flex justify-start">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} aria-hidden />
          <aside role="dialog" aria-modal="true" aria-label="System diagnostics" className="relative flex h-full w-full max-w-md flex-col border-r border-neutral-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                  <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden /> System Diagnostics
                </h2>
                <p className="text-xs text-neutral-500">
                  {count === 0 ? "No issues recorded" : `${count} recent ${count === 1 ? "event" : "events"}`} · {env ?? "…"}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close diagnostics" className="rounded p-1 text-neutral-500 hover:bg-neutral-100">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex flex-wrap gap-2 border-b border-neutral-200 px-4 py-2">
              <button
                type="button"
                onClick={copyDiagnostic}
                className="flex items-center gap-1.5 rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-700"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy Diagnostic"}
              </button>
              <button
                type="button"
                onClick={() => recordSentinelEvent({ kind: "diagnostic", message: "Test diagnostic event triggered from the debugger dock", stack: new Error("Test diagnostic").stack })}
                className="flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                <FlaskConical className="h-3.5 w-3.5" /> Test event
              </button>
              <button
                type="button"
                onClick={() => {
                  clearSentinelEvents();
                  setExpandedId(null);
                }}
                disabled={count === 0}
                className="ml-auto flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear Log
              </button>
            </div>

            <ul className="min-h-0 flex-1 divide-y divide-neutral-100 overflow-y-auto">
              {count === 0 && <li className="px-4 py-10 text-center text-sm text-neutral-400">Nothing to report. Errors and failed requests will appear here.</li>}
              {events.map((e) => {
                const expanded = expandedId === e.id;
                const badge = BADGE[e.kind];
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : e.id)}
                      aria-expanded={expanded}
                      className="flex w-full items-start gap-2 px-4 py-2.5 text-left hover:bg-neutral-50"
                    >
                      {expanded ? <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" /> : <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" />}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-xs text-neutral-500">
                          <span className="font-mono tabular-nums">{timeOf(e.timestamp)}</span>
                          <span className={`rounded px-1.5 py-0.5 font-medium ${badge.className}`}>
                            {badge.label}{e.status !== null && e.status > 0 ? ` ${e.status}` : ""}
                          </span>
                        </span>
                        <span className={`mt-1 block text-sm text-neutral-900 ${expanded ? "break-words" : "truncate"}`}>{e.message}</span>
                        <span className="block truncate font-mono text-xs text-neutral-400" title={e.source}>{e.source}</span>
                      </span>
                    </button>
                    {expanded && (
                      <div className="space-y-2 bg-neutral-50 px-4 pb-3 pl-9 text-xs">
                        <dl className="grid grid-cols-[4.5rem_1fr] gap-y-1 text-neutral-600">
                          <dt className="text-neutral-400">Route</dt>
                          <dd className="break-all font-mono">{e.route || "n/a"}</dd>
                          <dt className="text-neutral-400">Source</dt>
                          <dd className="break-all font-mono">{e.source || "n/a"}</dd>
                          <dt className="text-neutral-400">Environment</dt>
                          <dd className="capitalize">{env ?? "unknown"}</dd>
                        </dl>
                        {e.stack ? (
                          <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded border border-neutral-200 bg-white p-2 font-mono text-[11px] leading-snug text-neutral-700">{e.stack}</pre>
                        ) : (
                          <p className="text-neutral-400">No stack trace available.</p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>
      )}
    </>
  );
}
