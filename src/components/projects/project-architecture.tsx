"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown } from "lucide-react";
import { architectureLayers } from "@/lib/project-stack";
import { useProjects } from "@/lib/projects-context";
import { useIsClient } from "@/lib/use-is-client";
import { ProjectAvatar, ProjectNotFound } from "./project-overview";

export default function ProjectArchitecture({ projectId }: { projectId: string }) {
  const mounted = useIsClient();
  const { projects } = useProjects();
  const [selectedId, setSelectedId] = useState("ui");
  const project = projects.find((p) => p.id === projectId);

  if (!mounted) return <div className="h-full" />;
  if (!project) return <ProjectNotFound />;

  const base = `/projects/${project.id}`;
  const layers = architectureLayers(project);
  const selected = layers.find((l) => l.id === selectedId) ?? layers[0];

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
      <header className="flex items-center gap-3">
        <ProjectAvatar project={project} className="h-10 w-10 text-lg" />
        <div>
          <h1 className="text-xl font-semibold">System Architecture</h1>
          <p className="text-sm text-neutral-500">
            <Link href={base} className="hover:text-neutral-900">
              {project.name}
            </Link>{" "}
            · four decoupled layers
          </p>
        </div>
      </header>

      <section aria-label="Architecture layers" className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* Data-flow diagram: each layer only talks to its neighbours. */}
        <ol className="flex flex-col items-stretch">
          {layers.map((layer, i) => {
            const active = layer.id === selected.id;
            return (
              <li key={layer.id} className="flex flex-col items-center">
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedId(layer.id)}
                  className={`w-full rounded-lg border p-4 text-left shadow-sm transition ${
                    active ? "border-red-400 bg-red-50/50 ring-1 ring-red-300" : "border-neutral-200 bg-white hover:border-red-200"
                  }`}
                >
                  <span className="text-xs font-medium uppercase tracking-wide text-red-600">{layer.tag}</span>
                  <span className="mt-0.5 block text-sm font-semibold">{layer.title}</span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {layer.tech.map((t) => (
                      <span key={t} className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-xs text-neutral-700">
                        {t}
                      </span>
                    ))}
                  </span>
                </button>
                {i < layers.length - 1 && (
                  <div className="flex flex-col items-center py-1 text-xs text-neutral-400" aria-hidden>
                    <ArrowDown className="h-4 w-4" />
                    <span>{layers[i + 1].flow}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        <aside aria-live="polite" className="h-fit rounded-lg border border-neutral-200 bg-white p-4 shadow-sm lg:sticky lg:top-6">
          <p className="text-xs font-medium uppercase tracking-wide text-red-600">{selected.tag}</p>
          <h2 className="mt-0.5 text-base font-semibold">{selected.title}</h2>
          <p className="mt-2 text-sm text-neutral-600">{selected.summary}</p>
          <p className="mt-3 text-xs font-medium text-neutral-500">Data flow</p>
          <p className="text-sm text-neutral-700">{selected.flow}</p>
          <p className="mt-3 text-xs font-medium text-neutral-500">Technologies</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-neutral-700 marker:text-red-500">
            {selected.tech.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </aside>
      </section>

      <p className="text-xs text-neutral-500">
        Layers are derived from the tech stack in{" "}
        <Link href={`${base}/settings`} className="text-red-600 hover:underline">
          project settings
        </Link>
        . Edit it there to refine this view.
      </p>

      <nav aria-label="Related sections" className="flex flex-wrap gap-3">
        <Link href={`${base}/diagrams`} className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100">
          📐 Open Flowchart / Diagrams
        </Link>
        <Link href={`${base}/designs`} className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100">
          🎨 Open Design Studio
        </Link>
      </nav>
    </div>
  );
}
