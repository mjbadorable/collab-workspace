"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, Inbox, Landmark, ListTodo, Network, Plus } from "lucide-react";
import Greeting from "@/components/greeting";
import { priorityOptions, statusOptions } from "@/components/work-items/work-items-view";
import { useNewWorkItem } from "@/components/work-items/new-work-item-context";
import { mockWorkspace } from "@/lib/mock-data";
import { useProfile } from "@/lib/profile-context";
import { SEED_PROJECT, type ProjectRecord } from "@/lib/projects";
import { useProjects } from "@/lib/projects-context";
import { useWorkspaces } from "@/lib/workspace-context";
import { workItemKey, type StoredWorkItem } from "@/lib/work-items-storage";
import LiveWorkItems from "./live-work-items";
import ProjectCard from "./project-card";

const launchpad = (projectId: string) => [
  {
    href: `/projects/${projectId}/diagrams`,
    title: "Process Flowcharts",
    body: "User, system and backend flows for this project.",
    icon: Network,
  },
  { href: `/projects/${projectId}/architecture`, title: "System Architecture", body: "Layers, data flow and hosting at a glance.", icon: Landmark },
];

// Each card deep-links to the project's work items filtered by that status.
function Stats({ items, projectId }: { items: StoredWorkItem[] | null; projectId: string }) {
  const value = (fn: (i: StoredWorkItem) => boolean) => (items ? items.filter(fn).length : "–");
  const stats = [
    { label: "Open tasks", status: "backlog", value: value((i) => i.status !== "done"), icon: ListTodo },
    { label: "In progress", status: "in_progress", value: value((i) => i.status === "in_progress"), icon: Clock },
    { label: "Completed", status: "done", value: value((i) => i.status === "done"), icon: CheckCircle2 },
  ];
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-3">
      {stats.map(({ label, status, value, icon: Icon }) => (
        <Link
          key={label}
          href={`/projects/${projectId}/work-items?status=${status}`}
          className="group block cursor-pointer rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-red-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Icon className="h-4 w-4" aria-hidden />
            {label}
            <ArrowRight
              className="ml-auto h-4 w-4 -translate-x-1 text-red-500 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
              aria-hidden
            />
          </div>
          <p className="mt-2 text-3xl font-semibold">{value}</p>
        </Link>
      ))}
    </div>
  );
}

function WorkList({ items, project }: { items: StoredWorkItem[] | null; project: ProjectRecord }) {
  const { openDialog } = useNewWorkItem();
  const active = (items ?? []).filter((i) => i.status !== "done").sort((a, b) => a.seq - b.seq);

  if (items && active.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-dashed border-neutral-300 px-6 py-12 text-center">
        <Inbox className="h-8 w-8 text-neutral-400" aria-hidden />
        <h3 className="mt-3 text-base font-medium">Nothing on your plate</h3>
        <p className="mt-1 max-w-sm text-sm text-neutral-500">Open work items for your projects show up here.</p>
        <button
          type="button"
          onClick={openDialog}
          className="mt-4 flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
        >
          <Plus className="h-4 w-4" aria-hidden /> New work item
        </button>
      </div>
    );
  }

  if (!items) return <p className="py-8 text-center text-sm text-neutral-500">Loading work items…</p>;

  return (
    <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
      {active.slice(0, 8).map((item) => {
        const status = statusOptions.find((s) => s.value === item.status)!;
        const priority = priorityOptions.find((p) => p.value === item.priority)!;
        return (
          <li key={item.id}>
            <Link
              href={`/projects/${project.id}/work-items`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 hover:bg-neutral-50"
            >
              <span className="w-16 shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-center font-mono text-xs text-neutral-600">
                {workItemKey(project.id, item.seq)}
              </span>
              <span className="min-w-48 flex-1 truncate text-sm">{item.title}</span>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.tone}`}>
                {status.label}
              </span>
              <span
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${priority.tone}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${priority.dot}`} aria-hidden />
                {priority.label}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function HomeDashboard() {
  const { displayName } = useProfile();
  const { current } = useWorkspaces();
  const { projects } = useProjects();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The picked project, else the main one; falls back if the picked project was deleted.
  const selected = projects.find((p) => p.id === selectedId) ?? projects.find((p) => p.id === SEED_PROJECT.id) ?? projects[0] ?? SEED_PROJECT;
  const workspaceName = current?.name ?? mockWorkspace.name;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Greeting name={displayName} />
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-500">Here&apos;s what&apos;s on your plate in {workspaceName}.</p>
        {projects.length > 1 && (
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            Project
            <select
              value={selected.id}
              onChange={(e) => setSelectedId(e.target.value)}
              className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <LiveWorkItems projectId={selected.id} fallback={<div className="mt-6 h-96" />}>
        {(items, error) => (
          <>
            {error && (
              <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <Stats items={items} projectId={selected.id} />

            <h2 className="mt-8 text-sm font-semibold text-neutral-700">Active project</h2>
            <div className="mt-3">
              <ProjectCard project={selected} items={items} />
            </div>

            <h2 className="mt-8 text-sm font-semibold text-neutral-700">Your work items</h2>
            <div className="mt-3">
              <WorkList items={items} project={selected} />
            </div>
          </>
        )}
      </LiveWorkItems>

      <h2 className="mt-8 text-sm font-semibold text-neutral-700">Quick launchpad</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {launchpad(selected.id).map(({ href, title, body, icon: Icon }) => (
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
    </div>
  );
}
