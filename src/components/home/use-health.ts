"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { logActivity } from "@/lib/activity-log";
import { getProjects } from "@/lib/projects";
import { getWebhookUrl, sendWebhookAlert } from "@/lib/webhook";

export type Health =
  | { state: "none" }
  | { state: "checking" }
  | { state: "online"; status: number; latencyMs: number }
  | { state: "offline" };

// One finished health check. `ok: false` samples have status 0 and latency 0.
export type HealthSample = { ts: number; ok: boolean; status: number; latencyMs: number };

export const HISTORY_SIZE = 12;
// Several components may check the same URL on one page; samples this close together count as one check.
const MIN_SAMPLE_GAP_MS = 5_000;

const historyKey = (url: string) => `collab-workspace:health-history:${url}`;
const EMPTY_HISTORY: HealthSample[] = [];

const isSample = (value: unknown): value is HealthSample =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as HealthSample).ts === "number" &&
  typeof (value as HealthSample).ok === "boolean" &&
  typeof (value as HealthSample).status === "number" &&
  typeof (value as HealthSample).latencyMs === "number";

// useSyncExternalStore needs a referentially stable snapshot, so each URL's parsed list is cached per raw string.
const cache = new Map<string, { raw: string | null; list: HealthSample[] }>();
const listeners = new Set<() => void>();

function readHistory(url: string): HealthSample[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(historyKey(url));
  } catch {
    // storage blocked: history just stays empty
  }
  const hit = cache.get(url);
  if (hit && hit.raw === raw) return hit.list;
  let list = EMPTY_HISTORY;
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed.filter(isSample).slice(-HISTORY_SIZE);
    } catch {
      // corrupt JSON: start over
    }
  }
  cache.set(url, { raw, list });
  return list;
}

function appendSample(url: string, sample: HealthSample) {
  const current = readHistory(url);
  const last = current[current.length - 1];
  if (last && sample.ts - last.ts < MIN_SAMPLE_GAP_MS) return;
  try {
    localStorage.setItem(historyKey(url), JSON.stringify([...current, sample].slice(-HISTORY_SIZE)));
  } catch {
    return;
  }
  listeners.forEach((l) => l());
}

function subscribeHistory(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

const ALERT_GAP_MS = 5 * 60_000;

// An unreachable endpoint is logged to the activity feed and, if the project has a webhook, sent there too.
// Once per URL per 5 minutes, however many components or tabs are checking it.
function reportOffline(url: string) {
  const key = `collab-workspace:health-alert:${url}`;
  try {
    const last = Number(localStorage.getItem(key)) || 0;
    if (Date.now() - last < ALERT_GAP_MS) return;
    localStorage.setItem(key, String(Date.now()));
  } catch {
    return; // without storage the limit cannot hold, so do not alert on every check
  }
  logActivity({ kind: "health", title: "Production endpoint unreachable", detail: url });
  const project = getProjects().find((p) => p.live_url === url);
  const webhookUrl = project ? getWebhookUrl(project.id) : "";
  if (project && webhookUrl) {
    void sendWebhookAlert({
      webhookUrl,
      projectName: project.name,
      title: "Production endpoint unreachable",
      message: `${url} did not respond to the latest health check.`,
      state: "offline",
    });
  }
}

type Result = { key: string; health: Health };

// Pings /api/health-check for a project's live URL. Re-checks when the URL changes or recheck() is called.
// Every finished check is also appended to that URL's history (last 12, kept in localStorage).
export function useHealth(url: string): {
  health: Health;
  history: HealthSample[];
  uptimePercent: number | null;
  recheck: () => void;
} {
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const key = `${url}|${nonce}`;
  const history = useSyncExternalStore(
    subscribeHistory,
    () => (url ? readHistory(url) : EMPTY_HISTORY),
    () => EMPTY_HISTORY
  );

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    fetch(`/api/health-check?url=${encodeURIComponent(url)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d: { ok: boolean; status: number; latencyMs: number }) => {
        appendSample(url, { ts: Date.now(), ok: d.ok, status: d.ok ? d.status : 0, latencyMs: d.ok ? d.latencyMs : 0 });
        if (!d.ok) reportOffline(url);
        setResult({
          key,
          health: d.ok ? { state: "online", status: d.status, latencyMs: d.latencyMs } : { state: "offline" },
        });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        appendSample(url, { ts: Date.now(), ok: false, status: 0, latencyMs: 0 });
        reportOffline(url);
        setResult({ key, health: { state: "offline" } });
      });
    return () => controller.abort();
  }, [url, key]);

  const health: Health = !url ? { state: "none" } : result?.key === key ? result.health : { state: "checking" };
  const uptimePercent = history.length ? Math.round((history.filter((s) => s.ok).length / history.length) * 100) : null;
  return { health, history, uptimePercent, recheck: () => setNonce((n) => n + 1) };
}

export function healthLabel(health: Health): string {
  switch (health.state) {
    case "online":
      return `Production Live · ${health.status} OK (Latency ~${health.latencyMs}ms)`;
    case "offline":
      return "Offline / Unreachable";
    case "checking":
      return "Checking…";
    case "none":
      return "No live URL set";
  }
}

export const healthDot = (health: Health) =>
  health.state === "online"
    ? "bg-emerald-500"
    : health.state === "offline"
      ? "bg-red-500"
      : health.state === "checking"
        ? "bg-amber-400"
        : "bg-neutral-300";
