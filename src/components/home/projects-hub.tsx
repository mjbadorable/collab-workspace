"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { mockProjects } from "@/lib/mock-data";
import LiveWorkItems from "./live-work-items";
import ProjectCard from "./project-card";

export default function ProjectsHub() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const projects = mockProjects.filter((p) => !q || `${p.name} ${p.identifier}`.toLowerCase().includes(q));

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Projects</h1>
        <button
          type="button"
          disabled
          title="Creating projects is coming in a later milestone"
          className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden /> Add project
        </button>
      </div>

      <label className="relative mt-5 block max-w-xs">
        <span className="sr-only">Search projects</span>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects"
          className="w-full rounded-md border border-neutral-300 bg-white py-1.5 pl-8 pr-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </label>

      <LiveWorkItems fallback={<div className="mt-6 h-48" />}>
        {(items) =>
          projects.length === 0 ? (
            <p className="mt-6 py-16 text-center text-sm text-neutral-500">No projects match your search.</p>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {/* Only the main project has live data so far. */}
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} items={p.id === mockProjects[0].id ? items : null} />
              ))}
            </div>
          )
        }
      </LiveWorkItems>
    </div>
  );
}
