"use client";

import { healthDot, healthLabel, HISTORY_SIZE, useHealth, type HealthSample } from "./use-health";

const SLOW_MS = 350;

const barTone = (s: HealthSample) => (!s.ok ? "bg-red-500" : s.latencyMs < SLOW_MS ? "bg-emerald-500" : "bg-amber-400");

const barTitle = (s: HealthSample) =>
  `${s.ok ? `${s.status} OK` : "Down"} · ${s.ok ? `${s.latencyMs}ms` : "no response"} · ${new Date(s.ts).toLocaleString()}`;

// The last 12 checks, oldest on the left: green = fast, amber = slow (350ms+), red = down, gray = no data yet.
export function UptimeSparkline({ history }: { history: HealthSample[] }) {
  const empty = Math.max(0, HISTORY_SIZE - history.length);
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={`Last ${history.length} health checks`}>
      {Array.from({ length: empty }, (_, i) => (
        <span key={`empty-${i}`} className="h-3.5 w-1 rounded-xs bg-neutral-200" />
      ))}
      {history.map((s) => (
        <span key={s.ts} title={barTitle(s)} className={`h-3.5 w-1 rounded-xs ${barTone(s)}`} />
      ))}
    </span>
  );
}

export function UptimeBadge({ percent }: { percent: number | null }) {
  if (percent === null) return null;
  const tone = percent === 100 ? "text-emerald-700" : percent >= 80 ? "text-amber-700" : "text-red-700";
  return <span className={`shrink-0 font-medium tabular-nums ${tone}`}>{percent}% uptime</span>;
}

// Pings the project's production URL and shows status, latency and recent uptime history.
export default function HealthPill({ url }: { url: string }) {
  const { health, history, uptimePercent } = useHealth(url);
  return (
    <span
      role="status"
      className="flex max-w-full items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs text-neutral-600"
    >
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
        {health.state === "online" && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${healthDot(health)}`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${healthDot(health)}`} />
      </span>
      <span className="truncate">{healthLabel(health)}</span>
      <UptimeSparkline history={history} />
      <UptimeBadge percent={uptimePercent} />
    </span>
  );
}
