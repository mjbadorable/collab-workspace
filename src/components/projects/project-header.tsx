"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, FileDown, GitFork, Rocket } from "lucide-react";
import ProjectEnvBadge from "@/components/home/env-badge";
import HealthPill from "@/components/home/health-pill";
import LiveWorkItems from "@/components/home/live-work-items";
import { progressOf } from "@/components/home/project-card";
import PrivateBadge from "@/components/private-badge";
import ProjectAvatar from "@/components/project-avatar";
import DeploymentGateModal from "@/components/projects/deployment-gate-modal";
import ExportReportDialog from "@/components/projects/export-report-dialog";
import { GitActionMenu } from "@/components/projects/git-action-controls";
import type { ProjectRecord } from "@/lib/projects";

// Sub-navigation, grouped. `slug` is the path under /projects/<id>.
const TAB_GROUPS: { label: string; tabs: { label: string; slug: string }[] }[] = [
  {
    label: "Development",
    tabs: [
      { label: "Overview", slug: "" },
      { label: "Work Items", slug: "work-items" },
      { label: "Cycles", slug: "cycles" },
      { label: "Modules", slug: "modules" },
      { label: "Source Code", slug: "source" },
    ],
  },
  {
    label: "Technical Documentation",
    tabs: [
      { label: "System Architecture", slug: "architecture" },
      { label: "Flowcharts / Diagrams", slug: "diagrams" },
    ],
  },
  {
    label: "Insights",
    tabs: [
      { label: "Analytics", slug: "dashboards" },
      { label: "Project Settings", slug: "settings" },
    ],
  },
];

const actionClass =
  "flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-sm font-medium text-neutral-700 shadow-xs transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400";

function Completion({ project }: { project: ProjectRecord }) {
  return (
    <LiveWorkItems projectId={project.id} fallback={<div className="h-8 w-36" aria-hidden />}>
      {(items) => {
        const { done, total, percent } = progressOf(items);
        return (
          <div className="w-36">
            <div className="flex items-center justify-between text-xs text-neutral-600">
              <span className="tabular-nums">{items ? `${done}/${total} done` : "Loading…"}</span>
              <span className="font-medium tabular-nums">{percent}%</span>
            </div>
            <div
              role="progressbar"
              aria-label={`${project.name} completion`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100"
            >
              <div className={`h-full rounded-full ${percent === 100 ? "bg-emerald-500" : "bg-linear-to-r from-red-500 to-amber-400"}`} style={{ width: `${percent}%` }} />
            </div>
          </div>
        );
      }}
    </LiveWorkItems>
  );
}

// One header for /projects/[id] and every page under it: identity, health, progress, key actions and the grouped tabs.
export default function ProjectHeader({ project }: { project: ProjectRecord }) {
  const pathname = usePathname();
  const [gateOpen, setGateOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const base = `/projects/${project.id}`;
  const onOverview = pathname === base;
  const hrefOf = (slug: string) => (slug ? `${base}/${slug}` : base);
  const isActive = (slug: string) => (slug ? pathname === hrefOf(slug) || pathname.startsWith(`${hrefOf(slug)}/`) : onOverview);

  return (
    <header className="sticky top-14 z-20 border-b border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-6 pt-4">
        <ProjectAvatar project={project} className="h-11 w-11 text-lg" />
        <div className="min-w-0 flex-1 basis-64">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-lg font-semibold">{project.name}</h1>
            <span className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-xs text-neutral-600">{project.identifier}</span>
            <ProjectEnvBadge project={project} />
            <PrivateBadge project={project} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {project.live_url ? (
              <HealthPill url={project.live_url} />
            ) : (
              <span className="text-neutral-500">
                No live URL yet. Add one in{" "}
                <Link href={`${base}/settings`} className="text-red-600 hover:underline">
                  settings
                </Link>
                .
              </span>
            )}
          </div>
        </div>
        <Completion project={project} />
        <div className="flex flex-wrap items-center gap-2">
          {project.github_url && (
            <a href={project.github_url} target="_blank" rel="noopener noreferrer" aria-label="GitHub repository" title="GitHub repository" className={actionClass}>
              <GitFork className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden xl:inline">GitHub</span>
            </a>
          )}
          {project.live_url && (
            <a href={project.live_url} target="_blank" rel="noopener noreferrer" aria-label="Live app" title="Live app" className={actionClass}>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden xl:inline">Live App</span>
            </a>
          )}
          <button type="button" onClick={() => setGateOpen(true)} className={actionClass}>
            <Rocket className="h-3.5 w-3.5" aria-hidden /> Deployment Gate
          </button>
          <GitActionMenu projectId={project.id} className={actionClass} />
          {onOverview && (
            <button type="button" onClick={() => setExporting(true)} className={actionClass}>
              <FileDown className="h-3.5 w-3.5" aria-hidden /> Export Report
            </button>
          )}
        </div>
      </div>

      <nav aria-label={`${project.name} sections`} className="mt-3 flex items-end gap-5 overflow-x-auto px-6 pb-2.5">
        {TAB_GROUPS.map((group) => (
          <div key={group.label} role="group" aria-label={group.label} className="shrink-0">
            <p className="px-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{group.label}</p>
            <ul className="flex gap-1">
              {group.tabs.map((tab) => {
                const active = isActive(tab.slug);
                return (
                  <li key={tab.slug || "overview"}>
                    <Link
                      href={hrefOf(tab.slug)}
                      aria-current={active ? "page" : undefined}
                      className={`block whitespace-nowrap rounded-full px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${
                        active
                          ? "bg-red-600 font-semibold text-white shadow-xs"
                          : "font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                      }`}
                    >
                      {tab.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <DeploymentGateModal projectId={project.id} open={gateOpen} onClose={() => setGateOpen(false)} />
      <ExportReportDialog project={project} open={exporting} onClose={() => setExporting(false)} />
    </header>
  );
}
