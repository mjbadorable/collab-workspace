import { useSyncExternalStore } from "react";

export type ActivityKind = "task" | "health" | "project" | "webhook";
export type ActivityEvent = { id: string; ts: number; kind: ActivityKind; title: string; detail: string };

const LOG_KEY = "collab-workspace:activity-log";
const SEEN_KEY = "collab-workspace:activity-seen";
const MAX_EVENTS = 40;
const EMPTY: ActivityEvent[] = [];

const KINDS: readonly string[] = ["task", "health", "project", "webhook"];

const isEvent = (value: unknown): value is ActivityEvent => {
  if (typeof value !== "object" || value === null) return false;
  const e = value as ActivityEvent;
  return typeof e.id === "string" && typeof e.ts === "number" && KINDS.includes(e.kind) && typeof e.title === "string" && typeof e.detail === "string";
};

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// useSyncExternalStore needs a referentially stable snapshot, so the parsed list is cached per raw string.
let cachedRaw: string | null = null;
let cachedList: ActivityEvent[] = EMPTY;

function getEvents(): ActivityEvent[] {
  const raw = read(LOG_KEY);
  if (raw === cachedRaw) return cachedList;
  cachedRaw = raw;
  cachedList = EMPTY;
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) cachedList = parsed.filter(isEvent).slice(0, MAX_EVENTS);
    } catch {
      // corrupt JSON: start over
    }
  }
  return cachedList;
}

const getSeenAt = () => Number(read(SEEN_KEY)) || 0;

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

// Newest first, capped at 40 events.
export function logActivity(event: { kind: ActivityKind; title: string; detail: string }): void {
  const next: ActivityEvent = { id: crypto.randomUUID(), ts: Date.now(), ...event };
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify([next, ...getEvents()].slice(0, MAX_EVENTS)));
  } catch {
    return; // storage blocked: nothing to log to
  }
  notify();
}

export function clearActivityLog(): void {
  try {
    localStorage.removeItem(LOG_KEY);
  } catch {
    return;
  }
  notify();
}

// Everything logged so far counts as read.
export function markActivitySeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, String(Date.now()));
  } catch {
    return;
  }
  notify();
}

export function useActivityLog(): { events: ActivityEvent[]; unread: number } {
  const events = useSyncExternalStore(subscribe, getEvents, () => EMPTY);
  const seenAt = useSyncExternalStore(subscribe, getSeenAt, () => 0);
  return { events, unread: events.filter((e) => e.ts > seenAt).length };
}
