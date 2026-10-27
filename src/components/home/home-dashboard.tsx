"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, Inbox, ListTodo, Network, Palette, Plus } from "lucide-react";
import Greeting from "@/components/greeting";
import { priorityOptions, statusOptions } from "@/components/work-items/work-items-view";
import { useNewWorkItem } from "@/components/work-items/new-work-item-context";
import { useAuth } from "@/lib/auth-context";
import { mockUser, mockWorkspace } from "@/lib/mock-data";
import { SEED_PROJECT } from "@/lib/projects";
import { useProjects } from "@/lib/projects-context";
import { useWorkspaces } from "@/lib/workspace-context";
import { workItemKey, type StoredWorkItem } from "@/lib/work-items-storage";
import LiveWorkItems from "./live-work-items";
import ProjectCard from "./project-card";

const project = SEED_PROJECT;

const launchpad = [
  {
    href: `/projects/${project.id}/diagrams`,
    title: "React Flow Architecture",
    body: "Map flows and ERDs on the interactive canvas.",
    icon: Network,
  },
  { href: "/design", title: "UI Design Canvas", body: "Auto-layout mockups linked to your tasks.", icon: Palette },
];

function Stats({ items }: { items: StoredWorkItem[] | null }) {
  const value = (fn: (i: StoredWorkItem) => boolean) => (items ? items.filter(fn).length : "–");
  const stats = [
    { label: "Open tasks", value: value((i) => i.status !== "done"), icon: ListTodo },
    { label: "In progress", value: value((i) => i.status === "in_progress"), icon: Clock },
    { label: "Completed", value: value((i) => i.status === "done"), icon: CheckCircle2 },
  ];
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-3">
      {stats.map(({ label, value, icon: Icon }) => (
        <div key={label} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </div>
          <p className="mt-2 text-3xl font-semibold">{value}</p>
        </div>
      ))}
    </div>
  );
}

function WorkList({ items }: { items: StoredWorkItem[] | null }) {
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
  const { user } = useAuth();
  const { current } = useWorkspaces();
  const { projects } = useProjects();
  const primary = projects.find((p) => p.id === project.id) ?? project;
  // Cloud users are named after their email; local preview keeps the mock user.
  const name = user
    ? (user.email ?? "there").split("@")[0].replace(/[._-]+/g, " ")
    : mockUser.name.split(" ")[0];
  const workspaceName = current?.name ?? mockWorkspace.name;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Greeting name={name} />
      <p className="mt-1 text-sm text-neutral-500">Here&apos;s what&apos;s on your plate in {workspaceName}.</p>

      <LiveWorkItems fallback={<div className="mt-6 h-96" />}>
        {(items, error) => (
          <>
            {error && (
              <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <Stats items={items} />

            <h2 className="mt-8 text-sm font-semibold text-neutral-700">Active project</h2>
            <div className="mt-3">
              <ProjectCard project={primary} items={items} />
            </div>

            <h2 className="mt-8 text-sm font-semibold text-neutral-700">Your work items</h2>
            <div className="mt-3">
              <WorkList items={items} />
            </div>
          </>
        )}
      </LiveWorkItems>

      <h2 className="mt-8 text-sm font-semibold text-neutral-700">Quick launchpad</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {launchpad.map(({ href, title, body, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm hover:border-red-300"
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
