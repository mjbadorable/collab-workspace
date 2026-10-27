import Link from "next/link";
import { BarChart3, Network, Palette, SquareCheckBig, Users } from "lucide-react";
import type { MockProject } from "@/lib/mock-data";
import type { StoredWorkItem } from "@/lib/work-items-storage";

export function progressOf(items: StoredWorkItem[] | null) {
  const total = items?.length ?? 0;
  const done = items?.filter((i) => i.status === "done").length ?? 0;
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
}

const shortcuts = [
  { label: "Work items", slug: "work-items", icon: SquareCheckBig },
  { label: "Diagrams", slug: "diagrams", icon: Network },
  { label: "Designs", slug: "designs", icon: Palette },
];

export default function ProjectCard({ project, items }: { project: MockProject; items: StoredWorkItem[] | null }) {
  const { total, done, percent } = progressOf(items);
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-linear-to-br from-red-500 to-amber-400 font-mono text-xs font-semibold text-white">
          {project.identifier}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{project.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
            <span className="rounded-full border border-neutral-200 px-2 py-0.5">Public</span>
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
