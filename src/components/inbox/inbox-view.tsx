"use client";

import { useState } from "react";
import { CheckCheck, Inbox, Trash2 } from "lucide-react";
import { ACTIVITY_ICONS, timeAgo } from "@/components/activity-bell";
import { clearActivityLog, markActivitySeen, useActivityLog, type ActivityKind } from "@/lib/activity-log";

const FILTERS: { value: ActivityKind | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "task", label: "Tasks" },
  { value: "health", label: "Health alerts" },
  { value: "project", label: "Projects" },
  { value: "webhook", label: "Webhooks" },
];

// Everything the workspace has logged on this device (task changes, health alerts, webhook dispatches).
export default function InboxView() {
  const { events, unread, seenAt } = useActivityLog();
  const [filter, setFilter] = useState<ActivityKind | "all">("all");
  const shown = filter === "all" ? events : events.filter((e) => e.kind === filter);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Inbox className="h-5 w-5 text-red-600" aria-hidden /> Inbox
          {unread > 0 && <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold tabular-nums text-white">{unread} new</span>}
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={markActivitySeen}
            disabled={unread === 0}
            className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
          >
            <CheckCheck className="h-4 w-4" aria-hidden /> Mark all read
          </button>
          <button
            type="button"
            onClick={clearActivityLog}
            disabled={events.length === 0}
            className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Clear all
          </button>
        </div>
      </div>

      <div role="group" aria-label="Filter activity" className="mt-5 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              filter === f.value ? "border-red-200 bg-red-50 text-red-700" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-neutral-300 bg-white py-16 text-center text-sm text-neutral-500">
          {events.length === 0 ? "Nothing here yet. Task changes, health alerts and webhook dispatches show up as they happen." : "No activity of this kind."}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {shown.map((e) => {
            const { icon: Icon, tone } = ACTIVITY_ICONS[e.kind];
            const isNew = e.ts > seenAt;
            return (
              <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-neutral-900">{e.title}</span>
                    {isNew && <span className="h-2 w-2 shrink-0 rounded-full bg-red-600" aria-label="Unread" />}
                  </span>
                  <span className="block text-xs text-neutral-500">{e.detail}</span>
                </span>
                <span className="shrink-0 text-xs text-neutral-400">{timeAgo(e.ts)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
