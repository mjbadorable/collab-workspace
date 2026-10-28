"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Bell, FolderPlus, ListChecks, Send, type LucideIcon } from "lucide-react";
import { clearActivityLog, markActivitySeen, useActivityLog, type ActivityKind } from "@/lib/activity-log";

const ICONS: Record<ActivityKind, { icon: LucideIcon; tone: string }> = {
  task: { icon: ListChecks, tone: "bg-indigo-100 text-indigo-700" },
  health: { icon: Activity, tone: "bg-red-100 text-red-700" },
  project: { icon: FolderPlus, tone: "bg-emerald-100 text-emerald-700" },
  webhook: { icon: Send, tone: "bg-amber-100 text-amber-700" },
};

function timeAgo(ts: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - ts) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Bell with an unread badge; the panel lists recent activity (kept on this device) and opening it marks everything read.
export default function ActivityBell() {
  const { events, unread } = useActivityLog();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const toggle = () => {
    if (!open) markActivitySeen();
    setOpen((o) => !o);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread > 0 ? `Activity, ${unread} new` : "Activity"}
        className="relative rounded-md p-1.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800"
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Recent activity"
          className="absolute left-0 top-full z-30 mt-1 w-72 rounded-lg border border-neutral-200 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
            <h2 className="text-sm font-semibold">Activity</h2>
            {events.length > 0 && (
              <button type="button" onClick={clearActivityLog} className="text-xs text-red-600 hover:underline">
                Clear all
              </button>
            )}
          </div>
          {events.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-neutral-500">No activity yet.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-neutral-100 overflow-y-auto">
              {events.map((e) => {
                const { icon: Icon, tone } = ICONS[e.kind];
                return (
                  <li key={e.id} className="flex items-start gap-2.5 px-3 py-2.5">
                    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${tone}`}>
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-neutral-800">{e.title}</span>
                      <span className="block truncate text-xs text-neutral-500" title={e.detail}>
                        {e.detail}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] text-neutral-400">{timeAgo(e.ts)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
