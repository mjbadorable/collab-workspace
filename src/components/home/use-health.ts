"use client";

import { useEffect, useState } from "react";

export type Health =
  | { state: "none" }
  | { state: "checking" }
  | { state: "online"; status: number; latencyMs: number }
  | { state: "offline" };

type Result = { key: string; health: Health };

// Pings /api/health-check for a project's live URL. Re-checks when the URL changes or recheck() is called.
export function useHealth(url: string): { health: Health; recheck: () => void } {
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const key = `${url}|${nonce}`;

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    fetch(`/api/health-check?url=${encodeURIComponent(url)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d: { ok: boolean; status: number; latencyMs: number }) =>
        setResult({
          key,
          health: d.ok ? { state: "online", status: d.status, latencyMs: d.latencyMs } : { state: "offline" },
        })
      )
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key, health: { state: "offline" } });
      });
    return () => controller.abort();
  }, [url, key]);

  const health: Health = !url ? { state: "none" } : result?.key === key ? result.health : { state: "checking" };
  return { health, recheck: () => setNonce((n) => n + 1) };
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
