"use client";

import { healthDot, healthLabel, useHealth } from "./use-health";

// Pings the project's production URL and shows status plus latency.
export default function HealthPill({ url }: { url: string }) {
  const { health } = useHealth(url);
  return (
    <span
      role="status"
      className="flex max-w-full items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs text-neutral-600"
    >
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
        {health.state === "online" && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${healthDot(health)}`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${healthDot(health)}`} />
      </span>
      <span className="truncate">{healthLabel(health)}</span>
    </span>
  );
}
