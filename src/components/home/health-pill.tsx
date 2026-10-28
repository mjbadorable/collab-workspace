"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { healthDot, healthLabel, HISTORY_SIZE, useHealth, type HealthSample } from "./use-health";

const SLOW_MS = 350;
const RECENT_CHECKS = 5;

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

const ms = (value: number | null) => (value === null ? "–" : `${value}`);

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="text-sm font-semibold tabular-nums">
        {value}
        {unit && value !== "–" && <span className="text-[10px] font-normal text-neutral-500"> {unit}</span>}
      </p>
    </div>
  );
}

// Pings the project's production URL every minute and shows status, latency and recent uptime history.
// Click the status to open the latency telemetry; the arrow re-checks right now.
export default function HealthPill({ url }: { url: string }) {
  const { health, history, uptimePercent, stats, recheck } = useHealth(url);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const recent = [...history].reverse().slice(0, RECENT_CHECKS);
  const checking = health.state === "checking";

  return (
    <span ref={ref} className="relative inline-flex max-w-full">
      <span
        role="status"
        className="flex max-w-full items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 py-0.5 pl-2 pr-1 text-xs text-neutral-600"
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Show latency telemetry"
          className="flex min-w-0 items-center gap-2 rounded-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
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
        </button>
        <button
          type="button"
          onClick={recheck}
          disabled={checking}
          aria-label="Re-check now"
          title="Re-check now"
          className="shrink-0 rounded-full p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${checking ? "animate-spin" : ""}`} aria-hidden />
        </button>
      </span>

      {open && (
        <div role="dialog" aria-label="Latency telemetry" className="absolute left-0 top-full z-30 mt-1 w-72 rounded-lg border border-neutral-200 bg-white p-3 text-neutral-800 shadow-xl">
          <div className="grid grid-cols-4 gap-1.5">
            <Stat label="Uptime" value={uptimePercent === null ? "–" : `${uptimePercent}%`} />
            <Stat label="Min" value={ms(stats.minMs)} unit="ms" />
            <Stat label="Avg" value={ms(stats.avgMs)} unit="ms" />
            <Stat label="Max" value={ms(stats.maxMs)} unit="ms" />
          </div>
          <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-neutral-500">Last {RECENT_CHECKS} checks</p>
          {recent.length === 0 ? (
            <p className="mt-1 text-xs text-neutral-500">No checks recorded yet.</p>
          ) : (
            <ul className="mt-1 divide-y divide-neutral-100 text-xs">
              {recent.map((s) => (
                <li key={s.ts} className="flex items-center gap-2 py-1">
                  <span className="text-neutral-500">{new Date(s.ts).toLocaleTimeString()}</span>
                  <span className={`ml-auto font-medium ${s.ok ? "text-emerald-700" : "text-red-600"}`}>{s.ok ? `${s.status} OK` : "Down"}</span>
                  <span className="w-14 text-right tabular-nums text-neutral-600">{s.ok ? `${s.latencyMs}ms` : "–"}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-neutral-400">Checked automatically every minute while this tab is open.</p>
        </div>
      )}
    </span>
  );
}
