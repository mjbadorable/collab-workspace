"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";
import { parseDescription, serializeDescription } from "@/lib/checklist";
import {
  computeBurndownData,
  createCycle,
  daysRemaining,
  formatRange,
  getCycles,
  itemCycleId,
  updateCycle,
  type Cycle,
  type CycleStatus,
} from "@/lib/cycles";
import { useProjects } from "@/lib/projects-context";
import { useIsClient } from "@/lib/use-is-client";
import { workItemKey, type StoredWorkItem, type WorkItemStatus } from "@/lib/work-items-storage";
import { ProjectNotFound } from "./project-overview";
import { fireConfetti } from "@/components/confetti-burst";
import WorkItemsSource from "./work-items-source";

type Api = Parameters<Parameters<typeof WorkItemsSource>[0]["children"]>[0];

const TABS: { value: CycleStatus; label: string }[] = [
  { value: "active", label: "Active Cycle" },
  { value: "upcoming", label: "Upcoming Cycles" },
  { value: "completed", label: "Completed Cycles" },
];

const STATUS_BADGE: Record<WorkItemStatus, { label: string; tone: string }> = {
  backlog: { label: "Backlog", tone: "border-neutral-200 bg-neutral-100 text-neutral-700" },
  in_progress: { label: "In Progress", tone: "border-amber-200 bg-amber-50 text-amber-800" },
  done: { label: "Done", tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
};

// One click moves an item along backlog -> in progress -> done, and back to backlog from done.
const NEXT: Record<WorkItemStatus, { to: WorkItemStatus; label: string }> = {
  backlog: { to: "in_progress", label: "Start" },
  in_progress: { to: "done", label: "Complete" },
  done: { to: "backlog", label: "Reopen" },
};

const fieldClass =
  "w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500";

function countdown(c: Cycle): string {
  const d = daysRemaining(c);
  if (d > 1) return `${d} days remaining`;
  if (d === 1) return "1 day remaining";
  if (d === 0) return "Ends today";
  return `Ended ${-d} ${d === -1 ? "day" : "days"} ago`;
}

function progressOf(items: StoredWorkItem[]) {
  const done = items.filter((i) => i.status === "done").length;
  return { done, total: items.length, percent: items.length ? Math.round((done / items.length) * 100) : 0 };
}

function ProgressBar({ items }: { items: StoredWorkItem[] }) {
  const { done, total, percent } = progressOf(items);
  return (
    <div>
      <div
        role="progressbar"
        aria-label="Cycle progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 overflow-hidden rounded-full bg-neutral-100"
      >
        <div className="h-full rounded-full bg-linear-to-r from-red-500 to-amber-400" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        {done}/{total} tasks completed · {percent}%
      </p>
    </div>
  );
}

const CHART = { w: 500, h: 180, left: 34, right: 16, top: 12, bottom: 28 };

// Pure-SVG sprint burndown: the dashed line is the ideal pace, the solid line is what was really left each day.
function Burndown({ cycle, items, cycles }: { cycle: Cycle; items: StoredWorkItem[]; cycles: Cycle[] }) {
  const { total, days } = computeBurndownData(cycle, items, cycles);
  if (total === 0) return <p className="mt-4 text-sm text-neutral-500">Add tasks to this cycle to see its burndown.</p>;

  const plotW = CHART.w - CHART.left - CHART.right;
  const plotH = CHART.h - CHART.top - CHART.bottom;
  const x = (i: number) => CHART.left + (days.length > 1 ? (i / (days.length - 1)) * plotW : plotW / 2);
  const y = (v: number) => CHART.top + plotH - (v / total) * plotH;
  const points = (values: (number | null)[]) =>
    values.flatMap((v, i) => (v === null ? [] : [`${x(i).toFixed(1)},${y(v).toFixed(1)}`])).join(" ");
  const actual = days.filter((d) => d.actual !== null);

  return (
    <div className="mt-5 max-w-xl">
      <svg viewBox={`0 0 ${CHART.w} ${CHART.h}`} role="img" aria-label={`Sprint burndown for ${cycle.name}`} className="h-auto w-full">
        <line x1={CHART.left} y1={y(0)} x2={CHART.w - CHART.right} y2={y(0)} className="stroke-neutral-200" />
        <line x1={CHART.left} y1={y(total)} x2={CHART.w - CHART.right} y2={y(total)} className="stroke-neutral-200" strokeDasharray="2 4" />
        <text x={CHART.left - 6} y={y(total) + 4} textAnchor="end" className="fill-neutral-500 text-[10px]">
          {total}
        </text>
        <text x={CHART.left - 6} y={y(0) + 4} textAnchor="end" className="fill-neutral-500 text-[10px]">
          0
        </text>
        {[0, Math.floor((days.length - 1) / 2), days.length - 1].map((i, n) => (
          <text key={`${i}-${n}`} x={x(i)} y={CHART.h - 8} textAnchor={n === 0 ? "start" : n === 2 ? "end" : "middle"} className="fill-neutral-500 text-[10px]">
            Day {days[i].day}
          </text>
        ))}
        <polyline fill="none" strokeWidth="2" strokeDasharray="6 5" points={points(days.map((d) => d.ideal))} className="stroke-neutral-400" />
        <polyline fill="none" strokeWidth="2.5" points={points(days.map((d) => d.actual))} className="stroke-emerald-500" />
        {days.map((d, i) =>
          d.actual === null ? null : (
            <circle key={d.date} cx={x(i)} cy={y(d.actual)} r="4" strokeWidth="1.5" className="fill-emerald-500 stroke-white">
              <title>{`Day ${d.day}: ${d.actual} ${d.actual === 1 ? "task" : "tasks"} remaining`}</title>
            </circle>
          )
        )}
      </svg>
      <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-600">
        <li className="flex items-center gap-2">
          <svg width="22" height="6" aria-hidden>
            <line x1="0" y1="3" x2="22" y2="3" strokeWidth="2" strokeDasharray="5 4" className="stroke-neutral-400" />
          </svg>
          Ideal Guideline (dashed)
        </li>
        <li className="flex items-center gap-2">
          <svg width="22" height="6" aria-hidden>
            <line x1="0" y1="3" x2="22" y2="3" strokeWidth="2.5" className="stroke-emerald-500" />
          </svg>
          Actual Remaining (solid)
        </li>
      </ul>
      {actual.length === 0 && <p className="mt-1 text-xs text-neutral-500">This cycle has not started yet.</p>}
    </div>
  );
}

function ItemList({ projectId, items, onStatus }: { projectId: string; items: StoredWorkItem[]; onStatus: (id: string, status: WorkItemStatus) => void }) {
  if (items.length === 0) return <p className="px-4 py-3 text-sm text-neutral-500">No work items in this cycle yet.</p>;
  return (
    <ul className="divide-y divide-neutral-100">
      {items.map((item) => {
        const badge = STATUS_BADGE[item.status];
        const next = NEXT[item.status];
        const key = workItemKey(projectId, item.seq);
        return (
          <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
            <span className="w-16 shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-center font-mono text-xs text-neutral-600">{key}</span>
            <span className={`min-w-40 flex-1 truncate text-sm ${item.status === "done" ? "text-neutral-400 line-through" : ""}`}>{item.title}</span>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badge.tone}`}>{badge.label}</span>
            <button
              type="button"
              onClick={() => onStatus(item.id, next.to)}
              aria-label={`${next.label} ${key}`}
              className="rounded-md border border-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
            >
              {next.label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function CycleCard({
  projectId,
  cycle,
  items,
  onStatus,
  onCycleStatus,
}: {
  projectId: string;
  cycle: Cycle;
  items: StoredWorkItem[];
  onStatus: (id: string, status: WorkItemStatus) => void;
  onCycleStatus: (status: CycleStatus) => void;
}) {
  return (
    <section aria-label={cycle.name} className="rounded-xl border border-neutral-200 bg-white shadow-xs">
      <header className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{cycle.name}</h3>
            <p className="text-xs text-neutral-500">
              {formatRange(cycle)}
              {cycle.description && ` · ${cycle.description}`}
            </p>
          </div>
          {cycle.status === "upcoming" && (
            <button type="button" onClick={() => onCycleStatus("active")} className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50">
              Start cycle
            </button>
          )}
          {cycle.status === "active" && (
            <button type="button" onClick={() => onCycleStatus("completed")} className="rounded-md border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100">
              Mark completed
            </button>
          )}
          {cycle.status === "completed" && (
            <button type="button" onClick={() => onCycleStatus("active")} className="rounded-md border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100">
              Reopen cycle
            </button>
          )}
        </div>
        <ProgressBar items={items} />
      </header>
      <div className="border-t border-neutral-100">
        <ItemList projectId={projectId} items={items} onStatus={onStatus} />
      </div>
    </section>
  );
}

function NewCycleDialog({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (input: { name: string; description: string; startDate: string; endDate: string }) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    const startDate = String(f.get("start") ?? "");
    const endDate = String(f.get("end") ?? "");
    if (!name) return setError("Give the cycle a name.");
    if (!startDate || !endDate) return setError("Choose a start and an end date.");
    if (endDate < startDate) return setError("The end date must be on or after the start date.");
    onCreate({ name, description: String(f.get("description") ?? ""), startDate, endDate });
    setError(null);
    onClose();
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label="New cycle"
      className="m-auto w-full max-w-md rounded-xl border border-neutral-200 p-0 shadow-xl backdrop:bg-black/30"
    >
      {open && (
        <form onSubmit={submit} className="space-y-4 p-5">
          <h2 className="text-base font-semibold">New cycle</h2>
          <div>
            <label htmlFor="cy-name" className="mb-1 block text-xs font-medium text-neutral-600">Name</label>
            <input id="cy-name" name="name" required autoFocus maxLength={80} placeholder="Cycle 4: Launch prep" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="cy-desc" className="mb-1 block text-xs font-medium text-neutral-600">Goal <span className="font-normal text-neutral-400">(optional)</span></label>
            <textarea id="cy-desc" name="description" rows={2} className={`${fieldClass} resize-none`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cy-start" className="mb-1 block text-xs font-medium text-neutral-600">Start date</label>
              <input id="cy-start" name="start" type="date" required className={fieldClass} />
            </div>
            <div>
              <label htmlFor="cy-end" className="mb-1 block text-xs font-medium text-neutral-600">End date</label>
              <input id="cy-end" name="end" type="date" required className={fieldClass} />
            </div>
          </div>
          {error && <p role="alert" className="rounded-md bg-red-50 px-2.5 py-1.5 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100">Cancel</button>
            <button type="submit" className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">Create cycle</button>
          </div>
        </form>
      )}
    </dialog>
  );
}

function Planner({ projectId, api }: { projectId: string; api: Api }) {
  const [cycles, setCycles] = useState<Cycle[]>(() => getCycles(projectId));
  const [tab, setTab] = useState<CycleStatus>("active");
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");

  const live = (api.items ?? []).filter((i) => !i.deleted_at).sort((a, b) => a.seq - b.seq);
  const itemsOf = (c: Cycle) =>
    live.filter((i) => itemCycleId(cycles, parseDescription(i.description).cycle, i.created_at) === c.id);

  const active = cycles.find((c) => c.status === "active") ?? null;
  const inTab = cycles.filter((c) => c.status === tab);

  const addTask = (e: FormEvent) => {
    e.preventDefault();
    const title = taskTitle.trim();
    if (!title || !active) return;
    api.add({
      title,
      description: serializeDescription("", [], { cycle: active.name }) ?? "",
      status: "backlog",
      priority: "medium",
    });
    setTaskTitle("");
    setAdding(false);
  };

  return (
    <div className="space-y-6">
      {active ? (
        <section aria-label="Active cycle" className="rounded-xl border border-red-200 bg-linear-to-br from-white via-white to-red-50/40 p-5 shadow-xs">
          <p className="text-xs font-medium uppercase tracking-wide text-red-600">Active cycle</p>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">{active.name}</h2>
              <p className="text-sm text-neutral-500">
                {formatRange(active)} · <span className="font-medium text-neutral-700">{countdown(active)}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setCreating(true)} className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100">
                <Plus className="h-4 w-4" aria-hidden /> New Cycle
              </button>
              <button type="button" onClick={() => setAdding((v) => !v)} aria-expanded={adding} className="flex items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-red-700">
                <Plus className="h-4 w-4" aria-hidden /> Add task to this cycle
              </button>
            </div>
          </div>
          <div className="mt-4 max-w-md">
            <ProgressBar items={itemsOf(active)} />
          </div>
          <Burndown cycle={active} items={live} cycles={cycles} />
          {adding && (
            <form onSubmit={addTask} className="mt-4 flex max-w-md gap-2">
              <label htmlFor="cy-task" className="sr-only">Task title</label>
              <input id="cy-task" autoFocus value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} maxLength={200} placeholder="What needs doing this cycle?" className={fieldClass} />
              <button type="submit" className="shrink-0 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700">Add</button>
            </form>
          )}
        </section>
      ) : (
        <section aria-label="Active cycle" className="rounded-xl border border-dashed border-neutral-300 p-8 text-center">
          <RefreshCw className="mx-auto h-8 w-8 text-neutral-400" aria-hidden />
          <p className="mt-3 text-sm font-medium">No active cycle</p>
          <p className="mt-1 text-sm text-neutral-500">Start an upcoming cycle or create a new one to plan the next sprint.</p>
          <button type="button" onClick={() => setCreating(true)} className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
            <Plus className="h-4 w-4" aria-hidden /> New Cycle
          </button>
        </section>
      )}

      <div role="tablist" aria-label="Cycle status" className="flex gap-1 border-b border-neutral-200">
        {TABS.map((t) => (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${
              tab === t.value ? "border-red-600 font-medium text-neutral-900" : "border-transparent text-neutral-600 hover:text-neutral-900"
            }`}
          >
            {t.label}
            <span className="rounded-full bg-neutral-100 px-1.5 text-xs text-neutral-500">{cycles.filter((c) => c.status === t.value).length}</span>
          </button>
        ))}
      </div>

      {api.items === null ? (
        <p className="py-8 text-center text-sm text-neutral-500">Loading work items…</p>
      ) : inTab.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-500">
          No {tab} cycles.
        </p>
      ) : (
        <div className="space-y-4">
          {inTab.map((c) => (
            <CycleCard
              key={c.id}
              projectId={projectId}
              cycle={c}
              items={itemsOf(c)}
              onStatus={(id, status) => api.update(id, { status })}
              onCycleStatus={(status) => {
                setCycles(updateCycle(projectId, c.id, { status }));
                if (status === "completed") fireConfetti();
              }}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-neutral-500">
        Tag a work item with a cycle when you create or edit it; untagged items fall into the cycle that was running when they were created.
      </p>

      <NewCycleDialog open={creating} onClose={() => setCreating(false)} onCreate={(input) => setCycles(createCycle(projectId, input))} />
    </div>
  );
}

export default function CyclesView({ projectId }: { projectId: string }) {
  const mounted = useIsClient();
  const { projects } = useProjects();
  const project = projects.find((p) => p.id === projectId);

  if (!mounted) return <div className="h-full" />;
  if (!project) return <ProjectNotFound />;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-neutral-500">
        <Link href="/projects" className="hover:text-neutral-900">Projects</Link>
        <span aria-hidden>›</span>
        <Link href={`/projects/${project.id}`} className="hover:text-neutral-900">{project.name}</Link>
        <span aria-hidden>›</span>
        <span className="text-neutral-900">Cycles</span>
      </nav>
      <h1 className="mb-1 text-xl font-semibold">Cycles</h1>
      <p className="mb-6 text-sm text-neutral-500">Plan sprints and track progress cycle by cycle.</p>
      {/* Remounted per project so the cycle list never shows another project's data. */}
      <WorkItemsSource key={project.id} projectId={project.id} fallback={<div className="h-64" />}>
        {(api) => <Planner projectId={project.id} api={api} />}
      </WorkItemsSource>
    </div>
  );
}
