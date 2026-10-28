"use client";

import Link from "next/link";
import { Check, ExternalLink, GitFork } from "lucide-react";
import ProjectAvatar from "@/components/project-avatar";
import type { ProjectRecord } from "@/lib/projects";
import LiveWorkItems from "./live-work-items";
import PokedexRadar, { projectLevel } from "./pokedex-radar";

const TECH_ROWS: { name: string; pattern: RegExp }[] = [
  { name: "React 19", pattern: /\breact\b/ },
  { name: "Next.js 16", pattern: /next\.?js/ },
  { name: "Tailwind CSS v4", pattern: /tailwind/ },
  { name: "TypeScript", pattern: /typescript/ },
  { name: "IndexedDB (Dexie.js)", pattern: /dexie|indexeddb/ },
  { name: "Supabase", pattern: /supabase/ },
  { name: "React Flow", pattern: /react flow|xyflow/ },
  { name: "PDF.js", pattern: /pdf\.?js/ },
  { name: "SheetJS", pattern: /sheetjs/ },
  { name: "Lucide Icons", pattern: /lucide/ },
];

// Plain "react" must not match React Flow, which is its own row.
const usesTech = (project: ProjectRecord, pattern: RegExp, name: string) => {
  const stack = `${project.frontend_stack} ${project.backend_stack}`.toLowerCase();
  return pattern.test(name === "React 19" ? stack.replace(/react flow|@xyflow\/react/g, "") : stack);
};

export function DossierSelector({ projects, selectedId, onSelect }: { projects: ProjectRecord[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <ul aria-label="Choose a project" className="space-y-1.5">
      {projects.map((p) => (
        <li key={p.id}>
          <LiveWorkItems projectId={p.id} fallback={<div className="h-14 rounded-lg border border-neutral-200 bg-white" />}>
            {(items) => (
              <button
                type="button"
                onClick={() => onSelect(p.id)}
                aria-pressed={p.id === selectedId}
                className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${
                  p.id === selectedId ? "border-red-300 bg-red-50" : "border-neutral-200 bg-white hover:bg-neutral-50"
                }`}
              >
                <ProjectAvatar project={p} className="h-9 w-9 text-base" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="block text-xs text-neutral-500">Lv. {projectLevel(items)}</span>
                </span>
              </button>
            )}
          </LiveWorkItems>
        </li>
      ))}
    </ul>
  );
}

export function Dossier({ project }: { project: ProjectRecord }) {
  const base = `/projects/${project.id}`;
  const jumps = [
    { label: "Overview", href: base },
    { label: "Work items", href: `${base}/work-items` },
    { label: "Architecture", href: `${base}/architecture` },
    { label: "Cycles", href: `${base}/cycles` },
    { label: "Analytics", href: `${base}/dashboards` },
  ];

  return (
    <LiveWorkItems projectId={project.id} fallback={<div className="h-96 rounded-xl border border-neutral-200 bg-white" />}>
      {(items) => (
        <article aria-label={`${project.name} dossier`} className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
          <header className="flex items-start gap-3">
            <ProjectAvatar project={project} className="h-12 w-12 text-xl" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold">{project.name}</h2>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                <span className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-neutral-600">{project.identifier}</span>
                <span>Lv. {projectLevel(items)}</span>
                <span>{project.is_public ? "Public" : "Private"}</span>
                {project.lead && <span>Lead: {project.lead}</span>}
              </p>
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
          </header>
          <p className="mt-3 text-sm text-neutral-500">{project.description || "No description yet."}</p>

          <div className="mt-4">
            <PokedexRadar project={project} items={items} />
          </div>

          <nav aria-label="Jump to" className="mt-4 flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
            {jumps.map((j) => (
              <Link key={j.href} href={j.href} className="rounded-md border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100">
                {j.label}
              </Link>
            ))}
          </nav>
        </article>
      )}
    </LiveWorkItems>
  );
}

// Which of the fleet's key technologies each project uses, read from its declared stack.
export function FleetTechMatrix({ projects }: { projects: ProjectRecord[] }) {
  return (
    <section aria-labelledby="fleet-matrix" className="mt-6">
      <h2 id="fleet-matrix" className="text-sm font-semibold text-neutral-700">
        Fleet Technology Matrix
      </h2>
      <div className="mt-2 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-xl text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Technology</th>
              {projects.map((p) => (
                <th key={p.id} className="px-3 py-2 text-center font-medium">
                  {p.identifier}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {TECH_ROWS.map((row) => (
              <tr key={row.name}>
                <th scope="row" className="whitespace-nowrap px-4 py-2 font-medium">
                  {row.name}
                </th>
                {projects.map((p) => (
                  <td key={p.id} className="px-3 py-2 text-center">
                    {usesTech(p, row.pattern, row.name) ? (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                        <span className="sr-only">Uses {row.name}</span>
                      </span>
                    ) : (
                      <span className="text-neutral-300" aria-label={`Does not use ${row.name}`}>
                        –
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
