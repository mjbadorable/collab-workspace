"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { BarChart3, ExternalLink, GitFork, Landmark, Network, Pencil, RefreshCw, SquareCheckBig, Users } from "lucide-react";
import ProjectAvatar, { isPokeballProject } from "@/components/project-avatar";
import type { ProjectRecord } from "@/lib/projects";
import { useProjects } from "@/lib/projects-context";
import type { StoredWorkItem } from "@/lib/work-items-storage";
import { UptimeBadge, UptimeSparkline } from "./health-pill";
import { healthDot, healthLabel, useHealth } from "./use-health";

export function progressOf(items: StoredWorkItem[] | null) {
  const total = items?.length ?? 0;
  const done = items?.filter((i) => i.status === "done").length ?? 0;
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
}

const isHttpUrl = (value: string) => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

function HealthMonitor({ project }: { project: ProjectRecord }) {
  const { updateProject } = useProjects();
  const { health, history, uptimePercent, recheck } = useHealth(project.live_url);
  const [editing, setEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const github_url = String(f.get("repo") ?? "").trim();
    const live_url = String(f.get("live") ?? "").trim();
    if ((github_url && !isHttpUrl(github_url)) || (live_url && !isHttpUrl(live_url))) {
      setFormError("Enter valid http(s) URLs.");
      return;
    }
    setFormError(null);
    setEditing(false);
    updateProject(project.id, { github_url, live_url });
  };

  const dot = healthDot(health);
  const inputClass =
    "mt-1 w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-normal outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500";

  return (
    <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-2.5">
      <div className="flex items-center gap-2 text-xs">
        <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
          {health.state === "online" && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dot}`} />
          )}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dot}`} />
        </span>
        <span role="status" className="min-w-0 flex-1 truncate font-medium text-neutral-700">
          {healthLabel(health)}
        </span>
        <button
          type="button"
          onClick={recheck}
          disabled={health.state === "checking" || health.state === "none"}
          aria-label="Re-check health"
          title="Re-check health"
          className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${health.state === "checking" ? "animate-spin" : ""}`} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-expanded={editing}
          aria-label="Edit links"
          title="Edit links"
          className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {project.live_url && (
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <UptimeSparkline history={history} />
          {uptimePercent === null ? <span className="text-neutral-400">No history yet</span> : <UptimeBadge percent={uptimePercent} />}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {project.github_url && (
          <a
            href={project.github_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 py-1 text-neutral-700 hover:bg-neutral-100"
          >
            <GitFork className="h-3.5 w-3.5" aria-hidden /> GitHub
          </a>
        )}
        {project.live_url && (
          <a
            href={project.live_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 py-1 text-neutral-700 hover:bg-neutral-100"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Live App
          </a>
        )}
      </div>

      {editing && (
        <form onSubmit={save} className="mt-3 space-y-2 border-t border-neutral-200 pt-3">
          <label className="block text-xs font-medium text-neutral-600">
            GitHub repository URL
            <input name="repo" type="url" defaultValue={project.github_url} className={inputClass} />
          </label>
          <label className="block text-xs font-medium text-neutral-600">
            Live production URL
            <input name="live" type="url" defaultValue={project.live_url} className={inputClass} />
          </label>
          {formError && (
            <p role="alert" className="text-xs text-red-600">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-200"
            >
              Cancel
            </button>
            <button type="submit" className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700">
              Save
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

const shortcuts = [
  { label: "Work items", slug: "work-items", icon: SquareCheckBig },
  { label: "Diagrams", slug: "diagrams", icon: Network },
  { label: "Architecture", slug: "architecture", icon: Landmark },
];

export default function ProjectCard({ project, items }: { project: ProjectRecord; items: StoredWorkItem[] | null }) {
  const { total, done, percent } = progressOf(items);
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {isPokeballProject(project) ? (
          <ProjectAvatar project={project} className="h-10 w-10" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-linear-to-br from-red-500 to-amber-400 font-mono text-xs font-semibold text-white">
            {project.identifier}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{project.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
            <span className="rounded-full border border-neutral-200 px-2 py-0.5">{project.is_public ? "Public" : "Private"}</span>
            <span className="flex items-center gap-1 rounded-full border border-neutral-200 px-2 py-0.5">
              <Users className="h-3 w-3" aria-hidden /> 1 member
            </span>
            <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-medium text-red-700">
              Admin
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-neutral-600">
          <span className="flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" aria-hidden />
            {items ? `${done}/${total} tasks completed` : "Loading…"}
          </span>
          <span className="font-medium">{percent}%</span>
        </div>
        <div
          role="progressbar"
          aria-label={`${project.name} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-100"
        >
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              percent === 100 ? "bg-emerald-500" : "bg-linear-to-r from-red-500 to-amber-400"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <HealthMonitor project={project} />

      <div className="mt-4 flex flex-wrap gap-2">
        {shortcuts.map(({ label, slug, icon: Icon }) => (
          <Link
            key={slug}
            href={`/projects/${project.id}/${slug}`}
            className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
