"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, FolderKanban, GitFork, Plus, Search, Users } from "lucide-react";
import ProjectAvatar from "@/components/project-avatar";
import { useProjects } from "@/lib/projects-context";
import type { ProjectRecord } from "@/lib/projects";
import LiveWorkItems from "./live-work-items";
import { progressOf } from "./project-card";
import HealthPill from "./health-pill";
import { Dossier, DossierSelector, FleetTechMatrix } from "./pokedex-dossier";

type Tab = "all" | "joined";

function HubCard({ project }: { project: ProjectRecord }) {
  return (
    <LiveWorkItems projectId={project.id} fallback={<div className="h-56 rounded-lg border border-neutral-200 bg-white" />}>
      {(items) => {
        const { total, done, percent } = progressOf(items);
        return (
          <div className="flex flex-col rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <ProjectAvatar project={project} />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold">{project.name}</h3>
                <span className="mt-1 inline-block rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-xs text-neutral-600">
                  {project.identifier}
                </span>
              </div>
              <div className="flex gap-1 text-neutral-400">
                {project.github_url && (
                  <a href={project.github_url} target="_blank" rel="noopener noreferrer" aria-label="GitHub repository" className="rounded p-1 hover:bg-neutral-100 hover:text-neutral-700">
                    <GitFork className="h-4 w-4" aria-hidden />
                  </a>
                )}
                {project.live_url && (
                  <a href={project.live_url} target="_blank" rel="noopener noreferrer" aria-label="Live app" className="rounded p-1 hover:bg-neutral-100 hover:text-neutral-700">
                    <ExternalLink className="h-4 w-4" aria-hidden />
                  </a>
                )}
              </div>
            </div>

            <p className="mt-3 line-clamp-2 min-h-10 text-sm text-neutral-500">
              {project.description || "No description yet."}
            </p>

            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-neutral-600">
                <span>{items ? `${done}/${total}` : "Loading…"}</span>
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

            {project.live_url && (
              <div className="mt-3">
                <HealthPill url={project.live_url} />
              </div>
            )}

            <div className="mt-4 flex items-center gap-2 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
              <span className="rounded-full border border-neutral-200 px-2 py-0.5">{project.is_public ? "Public" : "Private"}</span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" aria-hidden /> 1 member
              </span>
              <span className="flex-1" />
              <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-medium text-red-700">Admin</span>
              <Link
                href={`/projects/${project.id}`}
                className="rounded-md bg-red-600 px-2.5 py-1 font-medium text-white hover:bg-red-700"
              >
                Open
              </Link>
            </div>
          </div>
        );
      }}
    </LiveWorkItems>
  );
}

export default function ProjectsHub() {
  const { projects, openCreateDialog, syncError } = useProjects();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [view, setView] = useState<"cards" | "dossier">("cards");
  const [dossierId, setDossierId] = useState<string | null>(null);
  const q = query.trim().toLowerCase();

  // There is no per-project membership yet: every project you can see is one you've joined.
  const joined = projects;
  const shown = (tab === "all" ? projects : joined).filter((p) => !q || `${p.name} ${p.identifier}`.toLowerCase().includes(q));

  // The dossier shows the picked project, or the first one in view if that one is filtered out or deleted.
  const dossierProject = shown.find((p) => p.id === dossierId) ?? shown[0];

  const tabs: { value: Tab; label: string; count: number }[] = [
    { value: "all", label: "All projects", count: projects.length },
    { value: "joined", label: "Joined", count: joined.length },
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <FolderKanban className="h-5 w-5 text-red-600" aria-hidden /> Projects
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative block">
            <span className="sr-only">Search projects</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects"
              className="w-56 rounded-md border border-neutral-300 bg-white py-1.5 pl-8 pr-2.5 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
            />
          </label>
          <div role="group" aria-label="View" className="flex rounded-md bg-neutral-100 p-0.5 text-sm">
            {(
              [
                ["cards", "Standard Cards"],
                ["dossier", "Pokédex Dossier"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => setView(value)}
                className={`rounded px-2.5 py-1 ${view === value ? "bg-white font-medium shadow-sm" : "text-neutral-600 hover:text-neutral-900"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={openCreateDialog}
            className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            <Plus className="h-4 w-4" aria-hidden /> Add project
          </button>
        </div>
      </div>

      <div role="tablist" aria-label="Project filter" className="mt-5 flex gap-1 border-b border-neutral-200">
        {tabs.map((t) => (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${
              tab === t.value ? "border-red-600 font-medium text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {t.label}
            <span className="rounded-full bg-neutral-100 px-1.5 text-xs text-neutral-600">{t.count}</span>
          </button>
        ))}
      </div>

      {syncError && (
        <p role="alert" className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Cloud sync failed: {syncError}. Projects are saved on this device. If this mentions a missing column, run{" "}
          <code className="font-mono">supabase/projects.sql</code>.
        </p>
      )}

      {shown.length === 0 ? (
        <p className="mt-6 py-16 text-center text-sm text-neutral-500">
          {projects.length === 0 ? "No projects yet. Create your first one." : "No projects match your search."}
        </p>
      ) : view === "dossier" ? (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-[16rem_1fr]">
            <DossierSelector projects={shown} selectedId={dossierProject.id} onSelect={setDossierId} />
            <Dossier key={dossierProject.id} project={dossierProject} />
          </div>
          <FleetTechMatrix projects={shown} />
        </>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            <HubCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
