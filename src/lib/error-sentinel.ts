import { useSyncExternalStore } from "react";

export type SentinelEventKind = "error" | "rejection" | "network" | "diagnostic";

export type SentinelEvent = {
  id: string;
  kind: SentinelEventKind;
  message: string;
  stack: string | null;
  // File:line for runtime errors, the request URL for network failures, the route otherwise.
  source: string;
  // HTTP status for network failures, null for everything else.
  status: number | null;
  route: string;
  timestamp: number;
};

type SentinelInput = Pick<SentinelEvent, "kind" | "message"> & Partial<Pick<SentinelEvent, "stack" | "source" | "status">>;

export const MAX_EVENTS = 20;

// Replaced (never mutated) on every change, so it is a valid useSyncExternalStore snapshot.
let events: readonly SentinelEvent[] = [];
const EMPTY: readonly SentinelEvent[] = [];
const listeners = new Set<() => void>();
let counter = 0;

const emit = () => listeners.forEach((l) => l());

export function recordSentinelEvent(input: SentinelInput): void {
  const route = typeof window === "undefined" ? "" : window.location.pathname;
  const event: SentinelEvent = {
    id: `evt-${Date.now()}-${++counter}`,
    kind: input.kind,
    message: input.message,
    stack: input.stack ?? null,
    source: input.source ?? route,
    status: input.status ?? null,
    route,
    timestamp: Date.now(),
  };
  events = [event, ...events].slice(0, MAX_EVENTS);
  emit();
}

export function clearSentinelEvents(): void {
  if (events.length === 0) return;
  events = [];
  emit();
}

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};

// Newest first. Empty during server render and hydration.
export function useSentinelEvents(): readonly SentinelEvent[] {
  return useSyncExternalStore(subscribe, () => events, () => EMPTY);
}

const describe = (value: unknown): { message: string; stack: string | null } => {
  if (value instanceof Error) return { message: value.message || value.name, stack: value.stack ?? null };
  if (typeof value === "string") return { message: value, stack: null };
  try {
    return { message: JSON.stringify(value) ?? String(value), stack: null };
  } catch {
    return { message: String(value), stack: null };
  }
};

const urlOf = (input: RequestInfo | URL): string => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
};

const isAbort = (reason: unknown) => reason instanceof DOMException && reason.name === "AbortError";

// Attaches the window listeners and a pass-through fetch wrapper. Every handler only observes: nothing calls
// preventDefault or swallows a rejection, so the browser console, React error boundaries and callers behave as before.
export function startErrorSentinel(): () => void {
  const onError = (e: ErrorEvent) => {
    const where = e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : undefined;
    const detail = describe(e.error ?? e.message);
    recordSentinelEvent({ kind: "error", message: detail.message || e.message, stack: detail.stack, source: where });
  };
  const onRejection = (e: PromiseRejectionEvent) => {
    if (isAbort(e.reason)) return;
    const detail = describe(e.reason);
    recordSentinelEvent({ kind: "rejection", message: detail.message, stack: detail.stack });
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  const originalFetch = window.fetch;
  const wrapped: typeof window.fetch = async (input, init) => {
    try {
      const response = await originalFetch.call(window, input, init);
      if (!response.ok) {
        recordSentinelEvent({
          kind: "network",
          message: `${init?.method ?? (input instanceof Request ? input.method : "GET")} ${response.status} ${response.statusText}`.trim(),
          source: urlOf(input),
          status: response.status,
        });
      }
      return response;
    } catch (error) {
      if (!isAbort(error)) {
        recordSentinelEvent({ kind: "network", message: describe(error).message, stack: describe(error).stack, source: urlOf(input), status: 0 });
      }
      throw error;
    }
  };
  window.fetch = wrapped;

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    // Only unwrap if nobody patched fetch on top of this wrapper.
    if (window.fetch === wrapped) window.fetch = originalFetch;
  };
}

export function formatDiagnostic(list: readonly SentinelEvent[], environment: string | null): string {
  const lines: string[] = [
    "# Diagnostic Report — collab-workspace",
    "",
    `- **Generated:** ${new Date().toISOString()}`,
    `- **Environment:** ${environment ?? "unknown"}`,
    `- **Route:** ${typeof window === "undefined" ? "n/a" : window.location.pathname}`,
    `- **User agent:** ${typeof navigator === "undefined" ? "n/a" : navigator.userAgent}`,
    `- **Events captured:** ${list.length}`,
    "",
  ];
  if (list.length === 0) lines.push("_No issues recorded._");
  list.forEach((e, i) => {
    lines.push(`## ${i + 1}. [${e.kind}${e.status !== null ? ` ${e.status}` : ""}] ${e.message}`);
    lines.push("");
    lines.push(`- **Time:** ${new Date(e.timestamp).toISOString()}`);
    lines.push(`- **Source:** ${e.source || "n/a"}`);
    lines.push(`- **Route:** ${e.route || "n/a"}`);
    if (e.stack) lines.push("", "```", e.stack, "```");
    lines.push("");
  });
  lines.push("Please triage: identify the likely root cause and propose a minimal fix.");
  return lines.join("\n");
}
