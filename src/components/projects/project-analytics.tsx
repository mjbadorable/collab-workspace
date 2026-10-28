"use client";

import LiveWorkItems from "@/components/home/live-work-items";
import { parseDescription, WORK_ITEM_LABELS, type WorkItemLabel } from "@/lib/checklist";
import type { StoredWorkItem, WorkItemPriority, WorkItemStatus } from "@/lib/work-items-storage";

const RADIUS = 48;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const STATUS_SEGMENTS: { status: WorkItemStatus; label: string; stroke: string; dot: string }[] = [
  { status: "done", label: "Done", stroke: "stroke-emerald-500", dot: "bg-emerald-500" },
  { status: "in_progress", label: "In Progress", stroke: "stroke-amber-400", dot: "bg-amber-400" },
  { status: "backlog", label: "Backlog", stroke: "stroke-neutral-300", dot: "bg-neutral-300" },
];

const PRIORITY_ROWS: { priority: WorkItemPriority; label: string; bar: string }[] = [
  { priority: "high", label: "High", bar: "bg-red-500" },
  { priority: "medium", label: "Medium", bar: "bg-blue-500" },
  { priority: "low", label: "Low", bar: "bg-neutral-400" },
];

const card = "rounded-xl border border-neutral-200 bg-white p-5 shadow-xs";

// Pure-SVG ring: one circle per status, each drawn as a dash of the circumference.
function StatusDonut({ items }: { items: StoredWorkItem[] }) {
  const total = items.length;
  const counts = STATUS_SEGMENTS.map((s) => ({ ...s, count: items.filter((i) => i.status === s.status).length }));
  const percent = total ? Math.round((counts[0].count / total) * 100) : 0;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 120 120" className="h-32 w-32 shrink-0 -rotate-90" role="img" aria-label={`${percent}% of work items are done`}>
        <circle cx="60" cy="60" r={RADIUS} fill="none" strokeWidth="14" className="stroke-neutral-100" />
        {total > 0 &&
          counts
            .filter((c) => c.count > 0)
            .map((c) => {
              const length = (c.count / total) * CIRCUMFERENCE;
              const circle = (
                <circle
                  key={c.status}
                  cx="60"
                  cy="60"
                  r={RADIUS}
                  fill="none"
                  strokeWidth="14"
                  strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                  strokeDashoffset={-offset}
                  className={c.stroke}
                />
              );
              offset += length;
              return circle;
            })}
        {/* Counter-rotated so the label reads upright inside the rotated ring. */}
        <text x="60" y="60" textAnchor="middle" dominantBaseline="central" transform="rotate(90 60 60)" className="fill-neutral-900 text-[22px] font-semibold">
          {percent}%
        </text>
      </svg>
      <ul className="space-y-1.5 text-sm">
        {counts.map((c) => (
          <li key={c.status} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} aria-hidden />
            <span className="text-neutral-600">{c.label}</span>
            <span className="ml-auto pl-4 font-medium tabular-nums">{c.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PriorityBars({ items }: { items: StoredWorkItem[] }) {
  const max = Math.max(1, ...PRIORITY_ROWS.map((r) => items.filter((i) => i.priority === r.priority).length));
  return (
    <ul className="space-y-3">
      {PRIORITY_ROWS.map((r) => {
        const count = items.filter((i) => i.priority === r.priority).length;
        return (
          <li key={r.priority}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-600">{r.label}</span>
              <span className="font-medium tabular-nums">{count}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-100">
              <div className={`h-full rounded-full ${r.bar}`} style={{ width: `${(count / max) * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function VelocitySummary({ items }: { items: StoredWorkItem[] }) {
  const parsed = items.map((i) => parseDescription(i.description));
  const tasks = parsed.flatMap((p) => p.tasks);
  const doneTasks = tasks.filter((t) => t.done).length;
  const byLabel = (label: WorkItemLabel) => parsed.filter((p) => p.label === label).length;

  return (
    <div>
      <p className="text-3xl font-semibold tabular-nums">
        {doneTasks}
        <span className="text-lg font-normal text-neutral-500">/{tasks.length}</span>
      </p>
      <p className="text-sm text-neutral-500">sub-tasks completed</p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {WORK_ITEM_LABELS.map((label) => (
          <li key={label} className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-xs">
            <span className="text-neutral-600">{label}</span> <span className="font-semibold tabular-nums">{byLabel(label)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Charts({ items }: { items: StoredWorkItem[] }) {
  return (
    <div className="mt-3 grid gap-4 md:grid-cols-3">
      <div className={card}>
        <h3 className="mb-4 text-sm font-semibold">Status breakdown</h3>
        <StatusDonut items={items} />
      </div>
      <div className={card}>
        <h3 className="mb-4 text-sm font-semibold">Priority distribution</h3>
        <PriorityBars items={items} />
      </div>
      <div className={card}>
        <h3 className="mb-4 text-sm font-semibold">Sub-task &amp; label velocity</h3>
        <VelocitySummary items={items} />
      </div>
    </div>
  );
}

// Charts for one project's live work items. Pass `items` to reuse a list already loaded; otherwise it loads its own.
export default function ProjectAnalytics({ projectId, items }: { projectId: string; items?: StoredWorkItem[] | null }) {
  return (
    <section aria-labelledby="ov-analytics">
      <h2 id="ov-analytics" className="text-sm font-semibold text-neutral-700">
        Project analytics &amp; velocity
      </h2>
      {items !== undefined ? (
        items ? <Charts items={items} /> : <div className="mt-3 h-48" />
      ) : (
        <LiveWorkItems projectId={projectId} fallback={<div className="mt-3 h-48" />}>
          {(loaded) => (loaded ? <Charts items={loaded} /> : <div className="mt-3 h-48" />)}
        </LiveWorkItems>
      )}
    </section>
  );
}
