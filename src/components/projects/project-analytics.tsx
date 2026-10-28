"use client";

import LiveWorkItems from "@/components/home/live-work-items";
import { dueBadge, localDateIso, parseDescription, WORK_ITEM_LABELS, type WorkItemLabel } from "@/lib/checklist";
import { getCycles, itemCycleId } from "@/lib/cycles";
import { getModules } from "@/lib/modules";
import { workItemKey, type StoredWorkItem, type WorkItemPriority, type WorkItemStatus } from "@/lib/work-items-storage";

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

const VELOCITY_DAYS = 14;

function daysBack(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(localDateIso(d));
  }
  return out;
}

// Tickets finished on each of the last 14 days (a done ticket without a completion stamp counts on the day it was created).
function CompletionVelocity({ items }: { items: StoredWorkItem[] }) {
  const days = daysBack(VELOCITY_DAYS);
  const finishedOn = items
    .filter((i) => i.status === "done")
    .map((i) => parseDescription(i.description).completedDate ?? i.created_at.slice(0, 10));
  const counts = days.map((d) => finishedOn.filter((f) => f === d).length);
  const max = Math.max(1, ...counts);
  const total = counts.reduce((a, b) => a + b, 0);

  const W = 500;
  const H = 160;
  const left = 24;
  const bottom = 22;
  const top = 10;
  const slot = (W - left) / days.length;
  const barW = slot * 0.62;

  return (
    <section className={card} aria-labelledby="an-velocity">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="an-velocity" className="text-sm font-semibold">14-day completion velocity</h3>
        <span className="text-xs text-neutral-500">{total} {total === 1 ? "ticket" : "tickets"} finished</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Tickets completed per day over the last ${VELOCITY_DAYS} days: ${total} in total`} className="mt-3 h-auto w-full">
        <line x1={left} y1={H - bottom} x2={W} y2={H - bottom} className="stroke-neutral-200" />
        <text x={left - 5} y={top + 4} textAnchor="end" className="fill-neutral-500 text-[10px]">{max}</text>
        <text x={left - 5} y={H - bottom} textAnchor="end" className="fill-neutral-500 text-[10px]">0</text>
        {days.map((d, i) => {
          const h = (counts[i] / max) * (H - bottom - top);
          const x = left + i * slot + (slot - barW) / 2;
          return (
            <g key={d}>
              <rect x={x} y={H - bottom - h} width={barW} height={Math.max(h, counts[i] > 0 ? 2 : 0)} rx="2" className="fill-emerald-500">
                <title>{`${d}: ${counts[i]} ${counts[i] === 1 ? "ticket" : "tickets"} completed`}</title>
              </rect>
              {(i === 0 || i === days.length - 1 || i % 4 === 0) && (
                <text x={x + barW / 2} y={H - 6} textAnchor="middle" className="fill-neutral-500 text-[9px]">{d.slice(5)}</text>
              )}
            </g>
          );
        })}
      </svg>
    </section>
  );
}

function ProgressRow({ label, done, total }: { label: string; done: number; total: number }) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="min-w-0 truncate text-neutral-700" title={label}>{label}</span>
        <span className="shrink-0 text-xs tabular-nums text-neutral-500">{done}/{total} · {percent}%</span>
      </div>
      <div role="progressbar" aria-label={`${label} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-100">
        <div className="h-full rounded-full bg-linear-to-r from-red-500 to-amber-400" style={{ width: `${percent}%` }} />
      </div>
    </li>
  );
}

// Cycles and modules side by side, each with how much of its work is done.
function CycleModuleBreakdown({ projectId, items }: { projectId: string; items: StoredWorkItem[] }) {
  const cycles = getCycles(projectId);
  const modules = getModules(projectId);
  const doneOf = (list: StoredWorkItem[]) => list.filter((i) => i.status === "done").length;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className={card} aria-labelledby="an-cycles">
        <h3 id="an-cycles" className="mb-3 text-sm font-semibold">Cycle progress</h3>
        {cycles.length === 0 ? (
          <p className="text-sm text-neutral-500">No cycles yet.</p>
        ) : (
          <ul className="space-y-3">
            {cycles.map((c) => {
              const mine = items.filter((i) => itemCycleId(cycles, parseDescription(i.description).cycle, i.created_at) === c.id);
              return <ProgressRow key={c.id} label={c.name} done={doneOf(mine)} total={mine.length} />;
            })}
          </ul>
        )}
      </section>
      <section className={card} aria-labelledby="an-modules">
        <h3 id="an-modules" className="mb-3 text-sm font-semibold">Module progress</h3>
        {modules.length === 0 ? (
          <p className="text-sm text-neutral-500">No modules yet.</p>
        ) : (
          <ul className="space-y-3">
            {modules.map((m) => {
              const mine = items.filter((i) => m.ticketKeys.includes(workItemKey(projectId, i.seq)) || parseDescription(i.description).module === m.name);
              return <ProgressRow key={m.id} label={m.name} done={doneOf(mine)} total={mine.length} />;
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Tile({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: "good" | "warn" | "neutral" }) {
  const color = tone === "good" ? "text-emerald-600" : tone === "warn" ? "text-red-600" : "text-neutral-900";
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-neutral-500">{hint}</p>
    </div>
  );
}

function HygieneScorecard({ projectId, items }: { projectId: string; items: StoredWorkItem[] }) {
  const parsed = items.map((item) => ({ item, p: parseDescription(item.description) }));
  const done = parsed.filter((x) => x.item.status === "done");
  const tracedPct = done.length ? Math.round((done.filter((x) => x.p.commit || x.p.pr).length / done.length) * 100) : null;
  const checklistPct = items.length ? Math.round((parsed.filter((x) => x.p.tasks.length > 0).length / items.length) * 100) : null;

  const statusByKey = new Map(items.map((i) => [workItemKey(projectId, i.seq), i.status] as const));
  const blockers = parsed.filter(
    (x) => x.item.status !== "done" && x.p.blockedBy && statusByKey.has(x.p.blockedBy) && statusByKey.get(x.p.blockedBy) !== "done"
  ).length;
  const overdue = parsed.filter((x) => dueBadge(x.p.dueDate, x.item.status)?.text.startsWith("Overdue")).length;

  return (
    <section className={card} aria-labelledby="an-hygiene">
      <h3 id="an-hygiene" className="mb-3 text-sm font-semibold">Engineering hygiene scorecard</h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Git traceability" value={tracedPct === null ? "–" : `${tracedPct}%`} hint="done tickets with a commit or PR linked" tone={tracedPct === null ? "neutral" : tracedPct >= 50 ? "good" : "neutral"} />
        <Tile label="Checklist coverage" value={checklistPct === null ? "–" : `${checklistPct}%`} hint="tickets with sub-tasks" tone={checklistPct === null ? "neutral" : checklistPct >= 50 ? "good" : "neutral"} />
        <Tile label="Active blockers" value={String(blockers)} hint="tickets waiting on an unfinished ticket" tone={blockers > 0 ? "warn" : "good"} />
        <Tile label="Overdue items" value={String(overdue)} hint="unfinished tickets past their due date" tone={overdue > 0 ? "warn" : "good"} />
      </div>
    </section>
  );
}

function Charts({ projectId, items, detailed }: { projectId: string; items: StoredWorkItem[]; detailed: boolean }) {
  return (
    <>
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
    {detailed && (
      <div className="mt-4 space-y-4">
        <CompletionVelocity items={items} />
        <CycleModuleBreakdown projectId={projectId} items={items} />
        <HygieneScorecard projectId={projectId} items={items} />
      </div>
    )}
    </>
  );
}

// Charts for one project's live work items. Pass `items` to reuse a list already loaded; otherwise it loads its own.
// `detailed` adds the 14-day velocity chart, cycle and module progress, and the hygiene scorecard.
export default function ProjectAnalytics({
  projectId,
  items,
  detailed = false,
}: {
  projectId: string;
  items?: StoredWorkItem[] | null;
  detailed?: boolean;
}) {
  return (
    <section aria-labelledby="ov-analytics">
      <h2 id="ov-analytics" className="text-sm font-semibold text-neutral-700">
        Project analytics &amp; velocity
      </h2>
      {items !== undefined ? (
        items ? <Charts projectId={projectId} items={items} detailed={detailed} /> : <div className="mt-3 h-48" />
      ) : (
        <LiveWorkItems projectId={projectId} fallback={<div className="mt-3 h-48" />}>
          {(loaded) => (loaded ? <Charts projectId={projectId} items={loaded} detailed={detailed} /> : <div className="mt-3 h-48" />)}
        </LiveWorkItems>
      )}
    </section>
  );
}
