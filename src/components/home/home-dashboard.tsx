"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  FolderKanban,
  FolderPlus,
  GitFork,
  Inbox,
  Landmark,
  ListPlus,
  Network,
  RefreshCw,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import { ACTIVITY_ICONS, timeAgo } from "@/components/activity-bell";
import Greeting from "@/components/greeting";
import PrivateBadge from "@/components/private-badge";
import ProjectAvatar from "@/components/project-avatar";
import DeploymentGateModal from "@/components/projects/deployment-gate-modal";
import { priorityOptions } from "@/components/work-items/work-items-view";
import { useNewWorkItem } from "@/components/work-items/new-work-item-context";
import { useActivityLog } from "@/lib/activity-log";
import { ensureCloudProject } from "@/lib/cloud-projects";
import { localDateIso, parseDescription } from "@/lib/checklist";
import { getCycles } from "@/lib/cycles";
import { mockWorkspace } from "@/lib/mock-data";
import { useProfile } from "@/lib/profile-context";
import { SEED_PROJECT, type ProjectRecord } from "@/lib/projects";
import { useProjects } from "@/lib/projects-context";
import { useWorkspaces } from "@/lib/workspace-context";
import { useStorageTarget } from "@/lib/storage-target";
import { useIsClient } from "@/lib/use-is-client";
import {
  fetchCloudWorkItemsForProjects,
  loadWorkItems,
  saveWorkItems,
  workItemKey,
  type StoredWorkItem,
} from "@/lib/work-items-storage";
import ProjectEnvBadge from "./env-badge";
import GymBadgeCase from "./gym-badge-case";
import LiveWorkItems from "./live-work-items";
import LocalDevWidget from "./local-dev-widget";
import ProjectCard, { progressOf } from "./project-card";
import { ProjectMoveControls } from "./project-move-controls";
import StandupDialog from "./standup-dialog";

const launchpad = (projectId: string) => [
  {
    href: `/projects/${projectId}/diagrams`,
    title: "Process Flowcharts",
    body: "User, system and backend flows for this project.",
    icon: Network,
  },
  { href: `/projects/${projectId}/architecture`, title: "System Architecture", body: "Layers, data flow and hosting at a glance.", icon: Landmark },
];

// Highest priority first.
const PRIORITY_RANK: Record<StoredWorkItem["priority"], number> = { high: 0, medium: 1, low: 2 };
const QUEUE_SIZE = 5;
const UPCOMING_SIZE = 5;

// "2026-11-10" -> "Nov 10", read as a local date so it never shifts a day.
function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type Tone = "indigo" | "emerald" | "amber" | "purple";

const TONES: Record<Tone, { card: string; badge: string }> = {
  indigo: { card: "border-indigo-200 bg-indigo-50", badge: "bg-indigo-100 text-indigo-700" },
  emerald: { card: "border-emerald-200 bg-emerald-50", badge: "bg-emerald-100 text-emerald-700" },
  amber: { card: "border-amber-200 bg-amber-50", badge: "bg-amber-100 text-amber-700" },
  purple: { card: "border-purple-200 bg-purple-50", badge: "bg-purple-100 text-purple-700" },
};

function KpiCard({ label, value, context, icon: Icon, tone, href }: { label: string; value: number; context: string; icon: LucideIcon; tone: Tone; href?: string }) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-neutral-600">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${TONES[tone].badge}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-neutral-500">{context}</p>
    </>
  );
  const cls = `block rounded-xl border p-4 ${TONES[tone].card}`;
  return href ? (
    <Link href={href} className={`${cls} transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function PortfolioRow({ project, items }: { project: ProjectRecord; items: StoredWorkItem[] }) {
  const { done, total, percent } = progressOf(items);
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <ProjectAvatar project={project} className="h-10 w-10 text-lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link href={`/projects/${project.id}`} className="truncate text-sm font-semibold hover:text-red-600">
            {project.name}
          </Link>
          <span className="shrink-0 rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[11px] text-neutral-600">{project.identifier}</span>
          <PrivateBadge project={project} />
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500">{project.description || "No description yet."}</p>
      </div>
      <div className="hidden md:block">
        <ProjectEnvBadge project={project} />
      </div>
      <div className="w-24 shrink-0 sm:w-32">
        <div className="flex items-center justify-between text-xs text-neutral-600">
          <span className="tabular-nums">
            {done}/{total}
          </span>
          <span className="font-medium tabular-nums">{percent}%</span>
        </div>
        <div
          role="progressbar"
          aria-label={`${project.name} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100"
        >
          <div className={`h-full rounded-full ${percent === 100 ? "bg-emerald-500" : "bg-linear-to-r from-red-500 to-amber-400"}`} style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="hidden sm:block">
        <ProjectMoveControls projectId={project.id} name={project.name} />
      </div>
      <Link href={`/projects/${project.id}`} aria-label={`Open ${project.name}`} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-red-600">
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
    </li>
  );
}

function Panel({ title, action, children }: { title: string; action?: { label: string; href: string }; children: React.ReactNode }) {
  return (
    <section className="flex flex-col rounded-xl border border-neutral-200 bg-white shadow-xs">
      <header className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-neutral-800">{title}</h2>
        {action && (
          <Link href={action.href} className="text-xs font-medium text-red-600 hover:underline">
            {action.label}
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

const EmptyNote = ({ children }: { children: React.ReactNode }) => <p className="px-4 py-8 text-center text-sm text-neutral-500">{children}</p>;

type Upcoming = { key: string; date: string; title: string; kind: string; project: ProjectRecord };

// The command center for the projects in scope. Work items come from each project's local board, so this only mounts on the client.
function CommandCenter({ projects, workspaceId, onOpenGate }: { projects: ProjectRecord[]; workspaceId: string | null; onOpenGate: () => void }) {
  const { openDialog } = useNewWorkItem();
  const { openCreateDialog } = useProjects();
  const { events } = useActivityLog();
  // Bumped after the cloud copy has been mirrored into localStorage, so the boards below are read again.
  const [syncedAt, setSyncedAt] = useState(0);

  // Signed in: pull every project's work items from Supabase and mirror them to the local cache this view reads.
  // A project with no cloud items yet is left alone (its board is seeded the first time it is opened).
  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    (async () => {
      try {
        const uuids = await Promise.all(projects.map((p) => ensureCloudProject(workspaceId, p.id)));
        const rows = await fetchCloudWorkItemsForProjects(uuids);
        if (cancelled) return;
        projects.forEach((p, i) => {
          const mine = rows.filter((r) => r.project_id === uuids[i]);
          if (mine.length > 0) saveWorkItems(p.id, mine);
        });
        setSyncedAt(Date.now());
      } catch {
        // offline or not allowed: the last local copy stays on screen
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, projects]);

  const boards = useMemo(
    () => projects.map((project) => ({ project, items: loadWorkItems(project.id).filter((i) => !i.deleted_at) })),
    // syncedAt is not read inside, but a new value means the local copy changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, syncedAt]
  );
  const cycles = useMemo(() => projects.map((project) => ({ project, cycles: getCycles(project.id) })), [projects]);

  const all = boards.flatMap((b) => b.items);
  const done = all.filter((i) => i.status === "done").length;
  const open = all.length - done;
  const inProgress = all.filter((i) => i.status === "in_progress").length;
  const activeCycles = cycles.reduce((n, c) => n + c.cycles.filter((cy) => cy.status === "active").length, 0);
  const withLive = projects.filter((p) => p.live_url).length;

  const queue = boards
    .flatMap((b, order) =>
      b.items.filter((i) => i.status !== "done").map((item) => ({ project: b.project, item, order, due: parseDescription(item.description).dueDate }))
    )
    .sort(
      (a, b) =>
        PRIORITY_RANK[a.item.priority] - PRIORITY_RANK[b.item.priority] ||
        (a.due ?? "9999").localeCompare(b.due ?? "9999") ||
        a.order - b.order ||
        a.item.seq - b.item.seq
    )
    .slice(0, QUEUE_SIZE);

  const today = localDateIso();
  const upcoming: Upcoming[] = [
    ...cycles.flatMap(({ project, cycles: list }) =>
      list.flatMap((c): Upcoming[] =>
        c.status === "active"
          ? [{ key: `${project.id}:${c.id}:end`, date: c.endDate, title: `${c.name.split(":")[0]} ends`, kind: "Cycle", project }]
          : c.status === "upcoming"
            ? [{ key: `${project.id}:${c.id}:start`, date: c.startDate, title: `${c.name.split(":")[0]} starts`, kind: "Cycle", project }]
            : []
      )
    ),
    ...boards.flatMap(({ project, items }) =>
      items.flatMap((item): Upcoming[] => {
        const due = parseDescription(item.description).dueDate;
        return item.status !== "done" && due && due >= today ? [{ key: `${project.id}:${item.id}:due`, date: due, title: item.title, kind: "Due", project }] : [];
      })
    ),
  ]
    .filter((u) => u.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, UPCOMING_SIZE);

  const quickActions: { label: string; icon: LucideIcon; onClick: () => void }[] = [
    { label: "New Project", icon: FolderPlus, onClick: openCreateDialog },
    { label: "New Work Item", icon: ListPlus, onClick: openDialog },
    // The create dialog is where a GitHub repo URL is pasted and broken down into a project plus tasks.
    { label: "Import from GitHub", icon: GitFork, onClick: openCreateDialog },
    { label: "Deployment Gate", icon: Rocket, onClick: onOpenGate },
  ];

  const firstProject = projects[0];

  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Projects" value={projects.length} context={`${withLive} with a live URL`} icon={FolderKanban} tone="indigo" href="/projects" />
        <KpiCard label="Completed Tasks" value={done} context={all.length ? `${Math.round((done / all.length) * 100)}% of ${all.length} tasks` : "No tasks yet"} icon={CheckCircle2} tone="emerald" />
        <KpiCard label="Open Tasks" value={open} context={`${inProgress} in progress`} icon={Clock} tone="amber" />
        <KpiCard label="Active Cycles" value={activeCycles} context={`across ${projects.length} ${projects.length === 1 ? "project" : "projects"}`} icon={RefreshCw} tone="purple" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Project Portfolio" action={{ label: "View All →", href: "/projects" }}>
            {boards.length === 0 ? (
              <EmptyNote>No projects yet. Create your first one.</EmptyNote>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {boards.map(({ project, items }) => (
                  <PortfolioRow key={project.id} project={project} items={items} />
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="My Priority Queue" action={{ label: "View All →", href: firstProject ? `/projects/${firstProject.id}/work-items` : "/projects" }}>
            {queue.length === 0 ? (
              <EmptyNote>
                <Inbox className="mx-auto mb-2 h-6 w-6 text-neutral-400" aria-hidden />
                Nothing open across your projects.
              </EmptyNote>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {queue.map(({ project, item, due }) => {
                  const priority = priorityOptions.find((p) => p.value === item.priority);
                  return (
                    <li key={`${project.id}:${item.id}`}>
                      <Link href={`/projects/${project.id}/work-items`} className="flex items-stretch gap-3 px-4 py-2.5 hover:bg-neutral-50">
                        <span className={`w-1 shrink-0 rounded-full ${priority?.dot ?? "bg-neutral-300"}`} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-neutral-800">{item.title}</span>
                          <span className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
                            <span className="rounded bg-neutral-100 px-1.5 font-mono text-[11px] text-neutral-600">{workItemKey(project.id, item.seq)}</span>
                            <span>{priority?.label} priority</span>
                            <span className="ml-auto tabular-nums">{due ? `Due ${shortDate(due)}` : "No due date"}</span>
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
        <div className="space-y-6">
          <GymBadgeCase />
          <Panel title="Quick Actions">
            <div className="grid grid-cols-2 gap-2 p-3">
              {quickActions.map(({ label, icon: Icon, onClick }) => (
                <button
                  key={label}
                  type="button"
                  onClick={onClick}
                  className="flex flex-col items-start gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-left text-sm font-medium text-neutral-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Recent Activity" action={{ label: "View All →", href: "/inbox" }}>
          {events.length === 0 ? (
            <EmptyNote>No activity yet. Task changes and health alerts appear here.</EmptyNote>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {events.slice(0, 5).map((e) => {
                const { icon: Icon, tone } = ACTIVITY_ICONS[e.kind];
                return (
                  <li key={e.id} className="flex items-start gap-2.5 px-4 py-2.5">
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
        </Panel>

        <Panel title="Upcoming" action={{ label: "View Calendar →", href: firstProject ? `/projects/${firstProject.id}/cycles` : "/projects" }}>
          {upcoming.length === 0 ? (
            <EmptyNote>
              <CalendarClock className="mx-auto mb-2 h-6 w-6 text-neutral-400" aria-hidden />
              No upcoming cycle dates or due items.
            </EmptyNote>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {upcoming.map((u) => (
                <li key={u.key} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-12 shrink-0 rounded-lg bg-neutral-100 py-1 text-center text-xs font-semibold tabular-nums text-neutral-700">{shortDate(u.date)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-neutral-800">{u.title}</span>
                    <span className="block text-xs text-neutral-500">
                      {u.kind} · {u.project.identifier}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

export default function HomeDashboard() {
  const { displayName } = useProfile();
  const { current } = useWorkspaces();
  const { projects } = useProjects();
  const mounted = useIsClient();
  const target = useStorageTarget();
  const workspaceId = target.mode === "cloud" ? target.workspaceId : null;
  const [selectedId, setSelectedId] = useState("all");
  const [standupOpen, setStandupOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const picked = projects.find((p) => p.id === selectedId);
  // "all" (the default) is the portfolio view; it is also the fallback if the picked project was deleted.
  const scoped = picked ?? null;
  const scope = useMemo(() => (picked ? [picked] : projects), [picked, projects]);
  const gateProject = scoped ?? projects[0] ?? SEED_PROJECT;
  const workspaceName = current?.name ?? mockWorkspace.name;
  // The date differs between server and client, so it only renders after mount.
  const today = mounted ? new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : "";

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Greeting name={displayName} />
          <p className="mt-1 text-sm text-neutral-500">Here&apos;s your engineering command center in {workspaceName}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-h-7 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium tabular-nums text-neutral-600">{today || " "}</span>
          {projects.length > 1 && (
            <label className="flex items-center gap-2 text-sm text-neutral-600">
              <span className="sr-only">Project scope</span>
              <select
                value={scoped ? scoped.id : "all"}
                onChange={(e) => setSelectedId(e.target.value)}
                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              >
                <option value="all">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={() => setStandupOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            📋 Daily Standup Digest
          </button>
        </div>
      </div>

      <div className="mt-6">
        <LocalDevWidget showFleetTabs />
      </div>

      {mounted && target.mode !== "loading" ? (
        <CommandCenter key={`${workspaceId ?? "local"}:${scoped?.id ?? "all"}`} projects={scope} workspaceId={workspaceId} onOpenGate={() => setGateOpen(true)} />
      ) : (
        <div className="mt-6 h-96" />
      )}

      {scoped && (
        <>
          <LiveWorkItems projectId={scoped.id} fallback={<div className="mt-6 h-40" />}>
            {(items, error) => (
              <>
                {error && (
                  <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </p>
                )}
                <h2 className="mt-8 text-sm font-semibold text-neutral-700">Active project</h2>
                <div className="mt-3">
                  <ProjectCard project={scoped} items={items} />
                </div>
              </>
            )}
          </LiveWorkItems>

          <h2 className="mt-8 text-sm font-semibold text-neutral-700">Quick launchpad</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {launchpad(scoped.id).map(({ href, title, body, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm hover:border-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-600">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="block text-xs text-neutral-500">{body}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-neutral-400 group-hover:text-red-600" aria-hidden />
              </Link>
            ))}
          </div>
        </>
      )}

      <DeploymentGateModal projectId={gateProject.id} open={gateOpen} onClose={() => setGateOpen(false)} />
      <StandupDialog open={standupOpen} onClose={() => setStandupOpen(false)} />
    </div>
  );
}
